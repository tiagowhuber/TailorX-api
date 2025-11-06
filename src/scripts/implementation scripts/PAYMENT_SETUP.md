# Quick Setup Guide - Transbank Webpay Payment System

## Step 1: Database Migration

Run the SQL migration to add payment fields to the orders table:

```bash
psql -U postgres -d tailorx -f src/scripts/implementation\ scripts/add-payment-fields-to-orders.sql
```

Or manually execute in your PostgreSQL client:
```sql
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS payment_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_url TEXT,
ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS session_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_transaction_id ON orders(transaction_id);
CREATE INDEX IF NOT EXISTS idx_orders_session_id ON orders(session_id);
```

## Step 2: Backend Environment Variables

Add to your `TailorX-api/.env` file:

```env
# Transbank Webpay Configuration (Integration/Test Environment)
TRANSBANK_API_URL=https://webpay3gint.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions
TRANSBANK_COMMERCE_CODE=597055555532
TRANSBANK_API_KEY=579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C
```

**Note:** These are test credentials for Transbank's integration environment.

## Step 3: Frontend Environment Variables

Ensure your `TailorX/.env` has:

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

## Step 4: Restart Both Servers

### Backend:
```bash
cd TailorX-api
npm run dev
```

### Frontend:
```bash
cd TailorX
npm run dev
```

## Step 5: Test the Payment Flow

1. **Login** to your account
2. **Generate a pattern** from a design
3. **Finalize the pattern** (required to add to cart)
4. **Add pattern to cart** from pattern view
5. **Go to cart** (`/carrito`)
6. **Click "Proceder al Checkout"**
7. You'll be redirected to Transbank's test payment page
8. Use Transbank's test cards to complete payment
9. You'll be redirected back to `/payment/confirmation`

## Test Cards (Transbank Integration Environment)

Consult Transbank documentation for current test card numbers. Generally:
- **Approved transactions:** Use specific test card numbers provided by Transbank
- **Rejected transactions:** Use specific rejection test cards

## Verifying the Implementation

### Check Backend Routes:
```bash
curl http://localhost:3000/api/payments/order/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Check Database:
```sql
SELECT * FROM orders WHERE payment_status = 'completed';
SELECT * FROM order_items WHERE order_id = 1;
SELECT * FROM order_status_history WHERE order_id = 1;
```

### Check Frontend Routes:
- `/carrito` - Cart page with checkout button
- `/payment/confirmation?token_ws=XXX` - Payment confirmation page

## Common Issues

### Backend won't start:
- Ensure database migration ran successfully
- Check environment variables are set
- Verify all TypeScript files compile without errors

### Payment creation fails:
- Check Transbank credentials in .env
- Verify API URL is correct
- Check server logs for detailed error messages

### Payment confirmation fails:
- Verify router has payment-confirmation route
- Check token is being passed in URL
- Review browser console for errors

## Production Checklist

Before going to production:

- [ ] Register with Transbank and complete certification
- [ ] Update `TRANSBANK_API_URL` to production URL
- [ ] Update `TRANSBANK_COMMERCE_CODE` to production code
- [ ] Update `TRANSBANK_API_KEY` to production key
- [ ] Test thoroughly with real cards in production environment
- [ ] Set up proper error monitoring
- [ ] Configure email notifications (future enhancement)
- [ ] Update return URL to production domain
- [ ] Enable HTTPS (required for production payments)

## Support

For detailed implementation information, see:
- `PAYMENT_IMPLEMENTATION.md` - Complete technical documentation
- Transbank Developer Documentation: https://www.transbankdevelopers.cl/

## File Checklist

Verify all these files exist:

**Backend:**
- [x] `src/controllers/paymentController.ts`
- [x] `src/routes/payments.ts`
- [x] `src/models/Order.ts` (updated)
- [x] `src/routes/index.ts` (updated)
- [x] `src/scripts/implementation scripts/add-payment-fields-to-orders.sql`

**Frontend:**
- [x] `src/types/payment.types.ts`
- [x] `src/stores/payment.ts`
- [x] `src/views/PaymentConfirmationView.vue`
- [x] `src/views/CartView.vue` (updated)
- [x] `src/lib/api.ts` (updated)
- [x] `src/router/index.ts` (updated)
