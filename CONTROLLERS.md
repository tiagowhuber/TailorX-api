# TailorX API Controllers

This document provides an overview of all implemented API controllers and their endpoints.

## Authentication

Most endpoints require authentication using JWT tokens. Include the token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Auth Controller (`/auth`)

### Public Endpoints
- `POST /auth/register` - Register a new user
- `POST /auth/login` - User login

### Protected Endpoints
- `POST /auth/logout` - User logout
- `GET /auth/me` - Get current authenticated user
- `POST /auth/refresh` - Refresh JWT token

## User Controller (`/users`)

### All Protected Endpoints
- `GET /users` - Get all users
- `GET /users/:id` - Get user by ID
- `POST /users` - Create new user
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user

## Measurement Type Controller (`/measurement-types`)

### Public Endpoints
- `GET /measurement-types` - Get all measurement types
- `GET /measurement-types/:id` - Get measurement type by ID
- `GET /measurement-types/freesewing/:key` - Get measurement type by FreeSewing key

### Protected Endpoints
- `POST /measurement-types` - Create new measurement type
- `PUT /measurement-types/:id` - Update measurement type
- `DELETE /measurement-types/:id` - Delete measurement type

## User Measurement Controller (`/user-measurements`)

### All Protected Endpoints
- `GET /user-measurements` - Get all user measurements (with optional user filter)
- `GET /user-measurements/user/:userId` - Get all measurements for a specific user
- `GET /user-measurements/user/:userId/type/:typeId` - Get specific measurement for user by type
- `GET /user-measurements/:id` - Get specific user measurement by ID
- `POST /user-measurements` - Create new user measurement
- `POST /user-measurements/batch` - Create or update multiple measurements for a user
- `PUT /user-measurements/:id` - Update user measurement
- `DELETE /user-measurements/:id` - Delete user measurement

## Design Controller (`/designs`)

### Public Endpoints
- `GET /designs` - Get all designs (with optional active filter)
- `GET /designs/active` - Get only active designs
- `GET /designs/freesewing/:pattern` - Get design by FreeSewing pattern name
- `GET /designs/:id` - Get design by ID
- `GET /designs/:id/measurements` - Get required measurements for a design

### Protected Endpoints
- `POST /designs` - Create new design
- `PUT /designs/:id` - Update design
- `DELETE /designs/:id` - Delete design (soft delete by setting is_active to false)
- `POST /designs/:id/measurements` - Add required measurement to design
- `DELETE /designs/:id/measurements/:measurementTypeId` - Remove required measurement from design

## Pattern Controller (`/patterns`)

### All Protected Endpoints
- `GET /patterns` - Get all patterns (with optional user and status filters)
- `GET /patterns/user/:userId` - Get all patterns for a specific user
- `GET /patterns/design/:designId` - Get all patterns for a specific design
- `GET /patterns/status/:status` - Get patterns by status
- `GET /patterns/:id` - Get pattern by ID
- `GET /patterns/:id/svg` - Get SVG data for pattern
- `POST /patterns` - Create new pattern
- `POST /patterns/generate` - Generate new pattern from design and measurements
- `PUT /patterns/:id` - Update pattern (name, status, etc.)
- `PUT /patterns/:id/finalize` - Finalize pattern (change status to finalized)
- `PUT /patterns/:id/archive` - Archive pattern (change status to archived)
- `DELETE /patterns/:id` - Delete pattern

## Order Controller (`/orders`)

### All Protected Endpoints
- `GET /orders` - Get all orders (with optional user and status filters)
- `GET /orders/user/:userId` - Get all orders for a specific user
- `GET /orders/number/:orderNumber` - Get order by order number
- `GET /orders/status/:status` - Get orders by status
- `GET /orders/:id` - Get order by ID
- `GET /orders/:id/items` - Get order items for an order
- `GET /orders/:id/status-history` - Get order status history
- `POST /orders` - Create new order
- `POST /orders/:id/items` - Add item to order
- `PUT /orders/:id` - Update order
- `PUT /orders/:id/items/:itemId` - Update order item
- `PUT /orders/:id/status` - Update order status
- `DELETE /orders/:id` - Cancel order (soft delete by setting status to cancelled)
- `DELETE /orders/:id/items/:itemId` - Remove item from order

## Response Format

All endpoints return responses in the following format:

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {...},
  "count": 10 // Only for list endpoints
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description"
}
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## Notes

1. **FreeSewing Integration**: Pattern generation endpoints are implemented but require integration with the FreeSewing library for actual pattern generation.

2. **Validation**: All controllers include proper input validation and error handling.

3. **Relationships**: Controllers properly handle database relationships and include related data in responses where appropriate.

4. **Authentication**: JWT-based authentication is implemented with bcrypt for password hashing.

5. **Database Operations**: All controllers use Sequelize ORM for database operations with proper error handling and transactions where needed.