# Testing TailorFit Service with Postman

This guide explains how to test the new PLT export functionality using Postman.

## Prerequisites

1.  Ensure the API is running:
    ```bash
    npm run dev
    ```
2.  You have a registered user account.

## Step 1: Authenticate

First, you need to log in to get an access token.

*   **Method**: `POST`
*   **URL**: `http://localhost:3000/api/auth/login`
*   **Body** (JSON):
    ```json
    {
      "email": "your-email@example.com",
      "password": "your-password"
    }
    ```
*   **Response**: Copy the `token` from the response.

## Step 2: Get a Pattern ID

You need a valid pattern ID that has SVG data.

*   **Method**: `GET`
*   **URL**: `http://localhost:3000/api/patterns`
*   **Headers**:
    *   `Authorization`: `Bearer YOUR_TOKEN_HERE`
*   **Response**: Look for a pattern `id` in the `data` array.

## Step 3: Export to PLT

Now call the new endpoint.

*   **Method**: `POST`
*   **URL**: `http://localhost:3000/api/patterns/:id/export/plt`
    *   Replace `:id` with the actual pattern ID (e.g., `123`).
*   **Headers**:
    *   `Authorization`: `Bearer YOUR_TOKEN_HERE`
*   **Send Request**:
    *   Click "Send and Download" (if available in your Postman version) or just "Send".
*   **Response**:
    *   If successful, you should receive a file download.
    *   **Single Bed**: A `.plt` file.
    *   **Multiple Beds**: A `.zip` file containing multiple `.plt` files.
    *   **Console Output**: Check the terminal running the API for logs like:
        ```
        Starting SVG processing...
        Parsed 15 pieces from SVG.
        Bed 1 Efficiency: 75.40%
        Nested pieces into 1 beds.
        ```

## Troubleshooting

*   **404 Pattern not found**: The ID is incorrect.
*   **400 Pattern has no SVG data**: The pattern exists but hasn't been generated properly. Try generating a new pattern first.
*   **500 Internal Server Error**: Check the server console logs for detailed error messages.
