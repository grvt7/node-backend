import { User } from '../models/user.model.js';
import ApiError from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import uploadOnCloud from '../utils/cloudinary.js';

const registerUser = asyncHandler(async (req, res) => {
  // Get user details from FE
  // Validations - not empty
  // Check if already exists: uname, email
  // Check for images/avatar: if avail upload
  // Create user object
  // Create DB Entry
  // Remove password and refresh token
  // Check for user creation
  // Return response
  const { username, password, email, fullname } = req.body;
  if (
    [username, password, email, fullname].some(
      (field) => field.trim() === null || field.trim() === '',
    )
  )
    throw new ApiError(400, 'All fields are necessary');

  const existantUser = await User.findOne({ $or: [{ username }, { email }] });
  if (existantUser)
    throw new ApiError(409, 'User with username or email already exists');

  const avatarLocal = req.files?.avatar[0]?.path;
  // const coverImageLocal = req.files?.coverImage[0]?.path;

  let coverImageLocal;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  )
    coverImageLocal = req.files?.coverImage[0]?.path;

  if (!avatarLocal) throw new ApiError(400, 'Avatar is required');

  let coverImage;
  const avatar = await uploadOnCloud(avatarLocal);
  if (coverImageLocal) coverImage = await uploadOnCloud(coverImageLocal);

  if (!avatar) throw new ApiError(400, 'Avatar is required');

  const newUser = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || '',
    email,
    username: username.toLowerCase(),
    password,
  });

  const createdUser = await User.findById(newUser._id).select(
    '-password -refreshToken',
  );

  if (!createdUser)
    throw new ApiError(500, 'Something went wrong while creating user');

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, 'User Registered Successfully'));
});

export { registerUser };
