# Transbank Webpay Payment Integration

This document describes the implementation of the Transbank Webpay payment system for TailorX.

## Overview

The payment system allows users to purchase patterns through Transbank's Webpay Plus gateway. The implementation follows a standard flow:

1. User adds patterns to cart
2. User proceeds to checkout
3. System creates order and initiates payment with Transbank
4. User is redirected to Webpay for payment
5. After payment, user is redirected back to TailorX
6. System confirms payment status and updates order

## Architecture

### Backend Components

#### 1. Database Changes

**New Order Model Fields:**
- `payment_status`: Status of the payment (pending, completed, failed, rejected, cancelled)
- `payment_method`: Payment method used (webpay)
- `payment_token`: Payment token from Transbank
- `payment_url`: Payment redirect URL from Transbank
- `transaction_id`: Transaction ID from payment provider
- `session_id`: Session ID for payment transaction

**Migration Script:** `src/scripts/implementation scripts/add-payment-fields-to-orders.sql`

#### 2. Payment Controller

**File:** `src/controllers/paymentController.ts`

**Functions:**
- `createPayment`: Creates order and initiates Transbank transaction
- `getPaymentState`: Confirms payment status with Transbank and updates order
- `getPaymentByOrderId`: Gets payment status for a specific order

**Key Features:**
- Validates cart items and patterns
- Creates order with OrderItems automatically
- Generates session IDs
- Handles Transbank API communication
- Updates order status based on payment result
- Creates OrderStatusHistory entries

#### 3. Payment Routes

**File:** `src/routes/payments.ts`

**Endpoints:**
- `POST /api/payments/create` - Create payment transaction (authenticated)
- `PUT /api/payments/confirm/:token` - Confirm payment status (public)
- `GET /api/payments/order/:orderId` - Get payment status by order (authenticated)

#### 4. Environment Variables

**File:** `.env.example`

```
TRANSBANK_API_URL=https://webpay3gint.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions
TRANSBANK_COMMERCE_CODE=597055555532
TRANSBANK_API_KEY=579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C
```

**Note:** The example credentials are for Transbank's integration environment. For production, replace with real credentials.

### Frontend Components

#### 1. Payment Types

**File:** `src/types/payment.types.ts`

Defines TypeScript interfaces for:
- `PaymentRequest`
- `PaymentResponse`
- `PaymentConfirmationResponse`
- `PaymentStatus`

#### 2. Payment Store (Pinia)

**File:** `src/stores/payment.ts`

**State:**
- `loading`: Payment processing state
- `error`: Error messages
- `currentOrderId`: Current order ID
- `currentPaymentToken`: Payment token
- `currentPaymentUrl`: Payment URL
- `paymentStatus`: Payment status data

**Actions:**
- `createPayment`: Creates payment transaction
- `confirmPayment`: Confirms payment with token
- `getPaymentStatus`: Gets payment status by order ID
- `redirectToPayment`: Redirects to Webpay
- `clearPaymentData`: Clears payment state

#### 3. Payment API Client

**File:** `src/lib/api.ts`

**Functions:**
- `paymentsApi.createPayment()`
- `paymentsApi.confirmPayment()`
- `paymentsApi.getPaymentStatus()`

#### 4. Payment Confirmation View

**File:** `src/views/PaymentConfirmationView.vue`

Displays payment result after Webpay redirect:
- Loading state while confirming payment
- Success state with order details
- Error state for failed/rejected/cancelled payments
- Clears cart on successful payment
- Navigation to patterns or home

#### 5. Updated Cart View

**File:** `src/views/CartView.vue`

**Changes:**
- Import `usePaymentStore`
- Added `processingCheckout` state
- Implemented `proceedToCheckout()` function
- Button shows loading state during checkout
- Validates user authentication
- Validates no archived patterns
- Creates payment and redirects to Webpay

#### 6. Router Configuration

**File:** `src/router/index.ts`

**New Route:**
```typescript
{
  path: '/payment/confirmation',
  name: 'payment-confirmation',
  component: PaymentConfirmationView,
  meta: { requiresAuth: false }
}
```

**Note:** Route is public to allow Transbank redirect without auth check.

## Payment Flow

### 1. Checkout Flow

```
User clicks "Proceder al Checkout"
  ↓
CartView.proceedToCheckout()
  ↓
paymentStore.createPayment(cart, userId)
  ↓
API: POST /api/payments/create
  ↓
Backend creates Order + OrderItems
  ↓
Backend calls Transbank API
  ↓
Transbank returns token + URL
  ↓
Backend saves token/URL to order
  ↓
Frontend receives response
  ↓
paymentStore.redirectToPayment(url, token)
  ↓
User redirected to Webpay
```

### 2. Payment Confirmation Flow

```
User completes payment on Webpay
  ↓
Transbank redirects to /payment/confirmation?token_ws=XXX
  ↓
PaymentConfirmationView mounted
  ↓
Extracts token from query params
  ↓
paymentStore.confirmPayment(token)
  ↓
API: PUT /api/payments/confirm/:token
  ↓
Backend calls Transbank to confirm
  ↓
Transbank returns payment status
  ↓
Backend updates Order status
  ↓
Backend creates OrderStatusHistory
  ↓
Frontend receives result
  ↓
Display success/error message
  ↓
Clear cart (if successful)
```

## Order States

### Order Status (`status` field)
- `pending`: Order created, awaiting payment
- `confirmed`: Payment authorized
- `processing`: Order being prepared (future use)
- `shipped`: Order shipped (future use)
- `completed`: Order completed (future use)
- `cancelled`: Order cancelled or payment failed

### Payment Status (`payment_status` field)
- `pending`: Payment not yet completed
- `completed`: Payment authorized and completed
- `failed`: Payment failed
- `rejected`: Payment rejected by bank
- `cancelled`: Payment cancelled by user

## Transbank Integration

### API Endpoints Used

**Create Transaction:**
```
POST https://webpay3gint.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions
Headers:
  - Tbk-Api-Key-Id: <commerce_code>
  - Tbk-Api-Key-Secret: <api_key>
Body:
  - buy_order: Order ID
  - session_id: Session ID
  - amount: Amount in CLP
  - return_url: Return URL after payment
```

**Confirm Transaction:**
```
PUT https://webpay3gint.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions/{token}
Headers:
  - Tbk-Api-Key-Id: <commerce_code>
  - Tbk-Api-Key-Secret: <api_key>
```

### Response Statuses

- `AUTHORIZED`: Payment successful
- `FAILED`: Payment failed
- `REJECTED`: Payment rejected
- `CANCELED`: Payment cancelled by user

## Testing

### Test Environment

The default configuration uses Transbank's integration environment:
- URL: `https://webpay3gint.transbank.cl`
- Commerce Code: `597055555532`
- API Key: `579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C`

### Test Cards

Transbank provides test cards for the integration environment:
- See Transbank documentation for current test card numbers

## Production Deployment

1. **Get Production Credentials:**
   - Register with Transbank
   - Complete certification process
   - Obtain production commerce code and API key

2. **Update Environment Variables:**
   ```
   TRANSBANK_API_URL=https://webpay3g.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions
   TRANSBANK_COMMERCE_CODE=<your_production_commerce_code>
   TRANSBANK_API_KEY=<your_production_api_key>
   ```

3. **Run Database Migration:**
   ```bash
   psql -U <user> -d <database> -f src/scripts/implementation scripts/add-payment-fields-to-orders.sql
   ```

4. **Update Frontend Environment:**
   ```
   VITE_API_BASE_URL=<your_production_api_url>
   ```

5. **Test thoroughly** before going live

## Security Considerations

- API keys are stored in environment variables (never in code)
- Payment confirmation endpoint is public (by design - Transbank redirects)
- Order verification ensures user can only see their own orders
- All payment amounts are validated server-side
- Cart items are validated against database
- Archived patterns cannot be purchased

## Future Enhancements

Potential improvements:
- Email notifications for order confirmation
- Order history view with payment details
- Refund functionality
- Multiple payment methods
- Discount codes (infrastructure ready, just skipped for now)
- Multi-currency support
- Webhooks for payment status updates
- Admin panel for order management

## Troubleshooting

### Common Issues

**Payment creation fails:**
- Check environment variables are set
- Verify Transbank credentials
- Check API URL is correct
- Verify patterns exist and are not archived

**Payment confirmation fails:**
- Check token is valid
- Verify Transbank API is accessible
- Check order exists in database
- Review server logs for Transbank errors

**User redirected but no payment data:**
- Check return URL is correct
- Verify router configuration
- Check browser console for errors

## File Structure

```
TailorX-api/
  src/
    controllers/
      paymentController.ts          (NEW)
    routes/
      payments.ts                    (NEW)
    models/
      Order.ts                       (MODIFIED - added payment fields)
    scripts/
      implementation scripts/
        add-payment-fields-to-orders.sql  (NEW)

TailorX/
  src/
    types/
      payment.types.ts              (NEW)
    stores/
      payment.ts                    (NEW)
    views/
      PaymentConfirmationView.vue   (NEW)
      CartView.vue                  (MODIFIED - added checkout)
    router/
      index.ts                      (MODIFIED - added route)
    lib/
      api.ts                        (MODIFIED - added payment API)
```

## Dependencies

No new dependencies required. Uses:
- Native `fetch` API for HTTP requests
- Existing Sequelize models
- Existing Vue/Pinia setup
- Existing Axios instance (frontend)

## Notes

- All amounts are in CLP (Chilean Pesos)
- Prices are frozen when patterns are added to cart
- Session IDs are auto-generated
- Order numbers are auto-generated
- Cart is cleared after successful payment
- Payment confirmation route is public (Transbank redirects to it)
