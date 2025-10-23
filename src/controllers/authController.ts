import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { User } from '../models';
import { generateToken } from '../config/jwt';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const loginUser = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Find user by email
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check password
    const isValidPassword = await user.checkPassword(password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Generate JWT token
    const token = generateToken({ id: user.id, email: user.email });

    // Remove password_hash from response
    const { password_hash: _, ...userResponse } = user.toJSON();

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        token,
      },
    });
  } catch (error) {
    console.error('Login user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const registerUser = async (req: Request, res: Response) => {
  try {
    const { email, password, first_name, last_name } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
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

    // Generate JWT token
    const token = generateToken({ id: user.id, email: user.email });

    // Remove password_hash from response
    const { password_hash: _, ...userResponse } = user.toJSON();

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: userResponse,
        token,
      },
    });
  } catch (error) {
    console.error('Register user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const logoutUser = async (req: Request, res: Response) => {
  try {
    // Since we're using stateless JWT tokens, logout is handled client-side
    // by removing the token from storage. We can add token blacklisting here if needed.
    
    res.json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('Logout user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    // The user is already attached to req by the authenticateToken middleware
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    // Remove password_hash from response
    const { password_hash: _, ...userResponse } = user.toJSON();

    res.json({
      success: true,
      data: userResponse,
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  try {
    // The user is already authenticated via middleware
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    // Generate new JWT token
    const token = generateToken({ id: user.id, email: user.email });

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        token,
      },
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const googleAuth = async (req: Request, res: Response) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: 'Google credential is required',
      });
    }

    // Verify the Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID!,
    });

    const payload = ticket.getPayload();
    
    if (!payload || !payload.email) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Google token',
      });
    }

    const { email, given_name, family_name, sub: googleId } = payload;

    // Check if user already exists
    let user = await User.findOne({ where: { email } });

    if (!user) {
      // Create new user with Google data
      const password_hash = await User.hashPassword(googleId); // Use Google ID as password
      
      const userData: any = {
        email,
        password_hash,
      };
      
      if (given_name) userData.first_name = given_name;
      if (family_name) userData.last_name = family_name;
      
      user = await User.create(userData);
    }

    // Generate JWT token
    const token = generateToken({ id: user.id, email: user.email });

    // Remove password_hash from response
    const { password_hash: _, ...userResponse } = user.toJSON();

    res.json({
      success: true,
      message: 'Google authentication successful',
      data: {
        user: userResponse,
        token,
      },
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};