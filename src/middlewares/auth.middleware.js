import { User } from '../models/user.model.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import jwt from 'jsonwebtoken';

export const verifyJWT = asyncHandler(async (req, res, next) => {
  try {
    const accessToken =
      req.cookies?.accessToken ||
      req.header('Authorization')?.replace('Bearer ', '');

    if (!accessToken) throw new ApiError(401, 'UnAuthorized Request');

    const decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(decoded?._id).select(
      '-password -refreshToken',
    );

    if (!user) throw new ApiError(401, 'Invalid Access Token');

    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(401, error?.message || 'Invalid Access Token');
  }
});
