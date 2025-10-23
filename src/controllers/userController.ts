import { Request, Response } from 'express';
import { User } from '../models';
import { Op } from 'sequelize';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { deleteProfilePicture, getFilePathFromUrl } from '../middleware/upload';

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password_hash'] },
      order: [['created_at', 'DESC']],
    });

    res.json({
      success: true,
      data: users,
      count: users.length,
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const user = await User.findByPk(id, {
      attributes: { exclude: ['password_hash'] },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const { email, password, first_name, last_name } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    // Hash password and create user
    const password_hash = await User.hashPassword(password);
    const user = await User.create({
      email,
      password_hash,
      first_name,
      last_name,
    });

    // Remove password_hash from response
    const { password_hash: _, ...userResponse } = user.toJSON();

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: userResponse,
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { email, first_name, last_name, password } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if email is being changed and if it already exists
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ 
        where: { 
          email,
          id: { [Op.ne]: id }
        } 
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists',
        });
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (email) updateData.email = email;
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (password) {
      updateData.password_hash = await User.hashPassword(password);
    }

    await user.update(updateData);

    // Remove password_hash from response
    const { password_hash: _, ...userResponse } = user.toJSON();

    res.json({
      success: true,
      message: 'User updated successfully',
      data: userResponse,
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    await user.destroy();

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const uploadUserProfilePicture = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check if user exists
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    // Process image with sharp (resize and optimize)
    const uploadDir = path.join(__dirname, '../../uploads/profile-pictures');
    const outputFilename = `processed_${req.file.filename}`;
    const outputPath = path.join(uploadDir, outputFilename);

    await sharp(req.file.path)
      .resize(400, 400, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality: 90 })
      .toFile(outputPath);

    // Delete original unprocessed file
    fs.unlinkSync(req.file.path);

    // Delete old profile picture if exists
    if (user.profile_picture_url) {
      const oldFilePath = getFilePathFromUrl(user.profile_picture_url);
      deleteProfilePicture(oldFilePath);
    }

    // Update user with new profile picture URL
    const profilePictureUrl = `/uploads/profile-pictures/${outputFilename}`;
    await user.update({ profile_picture_url: profilePictureUrl });

    res.json({
      success: true,
      message: 'Profile picture uploaded successfully',
      data: {
        profile_picture_url: profilePictureUrl,
      },
    });
  } catch (error) {
    console.error('Upload profile picture error:', error);
    
    // Clean up uploaded file if processing failed
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to upload profile picture',
    });
  }
};

export const deleteUserProfilePicture = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!user.profile_picture_url) {
      return res.status(400).json({
        success: false,
        message: 'User has no profile picture',
      });
    }

    // Delete the file
    const filePath = getFilePathFromUrl(user.profile_picture_url);
    deleteProfilePicture(filePath);

    // Update user - set to empty string to clear the field
    user.profile_picture_url = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Profile picture deleted successfully',
    });
  } catch (error) {
    console.error('Delete profile picture error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete profile picture',
    });
  }
};


