# Profile Picture Feature

This document describes the profile picture functionality implemented in TailorX.

## Overview

Users can now upload, update, and delete their profile pictures. The system supports:
- Local file storage with Express static file serving
- Image validation (type, size)
- Automatic image processing (resize to 400x400, optimize)
- Google OAuth profile picture capture
- Frontend preview and upload UI

## Backend Implementation

### Database Schema

Added `profile_picture_url` column to the `users` table:

```sql
ALTER TABLE users ADD COLUMN profile_picture_url VARCHAR(500);
```

### File Storage

- **Location**: `/uploads/profile-pictures/` (relative to project root)
- **Naming**: `processed_user_{userId}_{timestamp}_{random}.jpg`
- **Processing**: Images are resized to 400x400px and optimized with Sharp
- **Serving**: Static files served at `/uploads/profile-pictures/`

### API Endpoints

#### Upload Profile Picture
```
POST /api/users/:id/profile-picture
Authorization: Bearer {token}
Content-Type: multipart/form-data

Body: { profile_picture: File }

Response: {
  success: true,
  message: "Profile picture uploaded successfully",
  data: {
    profile_picture_url: "/uploads/profile-pictures/processed_user_1_123456.jpg"
  }
}
```

#### Delete Profile Picture
```
DELETE /api/users/:id/profile-picture
Authorization: Bearer {token}

Response: {
  success: true,
  message: "Profile picture deleted successfully"
}
```

### File Validation

- **Allowed types**: JPEG, JPG, PNG, WebP
- **Max size**: 2MB
- **Processing**: Resized to 400x400px, converted to JPEG (90% quality)

### Google OAuth Integration

When users sign in with Google:
1. Google profile picture URL is captured from `payload.picture`
2. Stored in `profile_picture_url` for new users
3. Updated for existing users without a profile picture

## Frontend Implementation

### User Type

Updated `User` interface in `auth.types.ts`:

```typescript
export interface User {
  id: number
  email: string
  first_name?: string
  last_name?: string
  profile_picture_url?: string  // Added
  created_at?: string
  updated_at?: string
}
```

### Auth Store Methods

Added methods to `stores/auth.ts`:

```typescript
// Update user profile (name)
updateProfile(data: { first_name?: string; last_name?: string })

// Upload profile picture
uploadProfilePicture(file: File)

// Delete profile picture
deleteProfilePicture()
```

### UI Components

**Avatar Display**:
- Uses `AvatarImage` component when profile picture exists
- Falls back to initials in `AvatarFallback`
- Displayed in header dropdown and account page

**Edit Profile Modal**:
- Profile picture preview (current or newly selected)
- File upload button
- Delete button (if profile picture exists)
- Real-time validation and error messages
- Automatic form reset on cancel

## Migration

To add the profile picture column to an existing database:

```bash
cd TailorX-api
npx ts-node src/scripts/add-profile-picture-column.ts
```

Or manually run:

```sql
ALTER TABLE users ADD COLUMN profile_picture_url VARCHAR(500);
```

## Future Enhancements

### Cloud Storage Migration

The current implementation uses local filesystem storage. To migrate to AWS S3 or Cloudinary:

1. **Install cloud SDK**:
   ```bash
   npm install aws-sdk
   # or
   npm install cloudinary
   ```

2. **Update `middleware/upload.ts`**:
   - Replace multer diskStorage with cloud storage
   - Update file URL generation
   - Keep the same validation logic

3. **Update `controllers/userController.ts`**:
   - Modify upload/delete handlers to use cloud APIs
   - Update URL construction

4. **Environment variables**:
   ```env
   # AWS S3
   AWS_ACCESS_KEY_ID=your_key
   AWS_SECRET_ACCESS_KEY=your_secret
   AWS_REGION=us-east-1
   AWS_BUCKET_NAME=tailorx-uploads

   # or Cloudinary
   CLOUDINARY_CLOUD_NAME=your_cloud
   CLOUDINARY_API_KEY=your_key
   CLOUDINARY_API_SECRET=your_secret
   ```

5. **Frontend changes**: Minimal - just update URL construction if needed

### Additional Features

- Image cropping/rotation UI
- Multiple profile picture sizes (thumbnail, medium, large)
- CDN integration for faster delivery
- Image compression improvements
- Upload progress indicator
- Drag-and-drop upload
- Camera capture for mobile

## Testing

### Manual Testing

1. **Upload**:
   - Navigate to Account page
   - Click "Editar Perfil"
   - Click "Subir" and select an image
   - Verify preview appears
   - Click "Guardar"
   - Verify image displays in avatar

2. **Delete**:
   - Click "Editar Perfil"
   - Click trash icon
   - Verify fallback to initials

3. **Google OAuth**:
   - Sign in with Google
   - Verify Google profile picture is saved
   - Check database for `profile_picture_url`

4. **Validation**:
   - Try uploading file > 2MB (should fail)
   - Try uploading non-image file (should fail)
   - Try uploading valid image (should succeed)

### File Cleanup

Old profile pictures are automatically deleted when:
- User uploads a new picture
- User deletes their profile picture
- User account is deleted (cascade delete recommended)

## Security Considerations

✅ **Implemented**:
- File type validation (MIME type check)
- File size limits (2MB max)
- Authentication required for all endpoints
- User can only modify their own profile picture
- Unique file naming prevents conflicts

🔒 **Recommended additions**:
- Rate limiting on upload endpoint
- Malware scanning for uploaded files
- HTTPS enforcement
- Image dimension validation
- Content Security Policy headers

## Troubleshooting

**Images not displaying**:
- Verify uploads directory exists: `TailorX-api/uploads/profile-pictures/`
- Check Express is serving static files: `/uploads` route configured
- Verify file permissions on uploads directory
- Check browser console for CORS errors

**Upload failing**:
- Check file size (< 2MB)
- Verify file type (JPEG, PNG, WebP only)
- Check server logs for multer errors
- Ensure authentication token is valid

**Google pictures not saving**:
- Verify Google OAuth payload contains `picture` field
- Check `authController.ts` is extracting `picture` from payload
- Review database logs for constraint violations
