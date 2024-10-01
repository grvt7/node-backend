import mongoose from 'mongoose';
import { User } from '../models/user.model.js';
import ApiError from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import uploadOnCloud from '../utils/cloudinary.js';
import jwt from 'jsonwebtoken';

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      'Something went wrong while generating access and refresh token',
    );
  }
};

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

const loginUser = asyncHandler(async (req, res) => {
  // Get formData from user
  // Check validations
  // Check access token -> if valid procees
  // If Invalid Check Refresh Token
  // Generate access toekn
  // Find user
  // Check password
  // generate access/refresh token
  // Send using secure cookies

  const { username, email, password } = req.body;
  if (!(username || email))
    throw new ApiError(400, 'Username or email is required');

  const user = await User.findOne({ $or: [{ username }, { email }] });

  if (!user) throw new ApiError(404, 'User does not exist');

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) throw new ApiError(404, 'Password is Invalid');

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id,
  );

  const loggedInUser = await User.findById(user._id).select(
    '-password -refreshToken',
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie('accessToken', accessToken, options)
    .cookie('refreshToken', refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        'User logged in successfully',
      ),
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1,
      },
    },
    {
      new: true,
    },
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie('accessToken', options)
    .clearCookie('refreshToken', options)
    .json(new ApiResponse(200, {}, 'User Logged Out'));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body.refreshToken;
  if (!incomingRefreshToken) throw new ApiError(401, 'Unauthorized request');

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET,
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) throw new ApiError(401, 'Invalid Refresh Token');

    if (incomingRefreshToken !== user?.refreshToken)
      throw new ApiError(401, 'Refresh Token Expeired');

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
      user._id,
    );

    return res
      .status(200)
      .cookie('accessToken', accessToken, options)
      .cookie('refreshToken', refreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken },
          'Token Refreshed Successfully',
        ),
      );
  } catch (error) {
    throw new ApiError(401, error?.message || 'Invalid Refresh Token');
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req.user?._id);

  const isPasswordCorrent = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrent) throw new ApiError(400, 'Invalid Old Password');

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, 'Password Changes Successfully'));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, 'Current User Fetched Successfully'));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullname, email } = req.body;

  if (!fullname || !email) throw new ApiError(400, 'All Fields are required');

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        fullname: fullname,
        email: email,
      },
    },
    { new: true },
  ).select('-password');

  return res
    .status(200)
    .json(new ApiResponse(200, user, 'Account Details Updated'));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalFile = req.files?.path;
  if (!avatarLocalFile) throw new ApiError(400, 'Avatar file is missing');

  const avatar = await uploadOnCloud(avatarLocalFile);

  if (!avatar.url) throw new ApiError(400, 'Error while uploading on avatar');

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true },
  ).select('-password');

  return res
    .status(200)
    .json(new ApiResponse(200, user, 'Avatar Updated Successfully'));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.files?.path;
  if (!coverImageLocalPath)
    throw new ApiError(400, 'Cover Image file is missing');

  const coverImage = await uploadOnCloud(coverImageLocalPath);

  if (!coverImage.url)
    throw new ApiError(400, 'Error while uploading on cover Image');

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true },
  ).select('-password');

  return res
    .status(200)
    .json(new ApiResponse(200, user, 'Cover Image Updated Successfully'));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username?.trim()) throw new ApiError(400, 'Username is Missing');

  const channel = await User.aggregate([
    {
      $match: {
        username: username.toLowerCase(),
      },
      $lookup: {
        from: 'subscriptions',
        localField: '_id',
        foreignField: 'channel',
        as: 'subscribers',
      },
      $lookup: {
        from: 'subscriptions',
        localField: '_id',
        foreignField: 'subscriber',
        as: 'subscribedTo',
      },
      $addFields: {
        subscribersCount: {
          $size: '$subscribers',
        },
        subscribedToCount: {
          $size: '$subscribedTo',
        },
        isSubscribed: {
          $cond: {
            if: {
              $in: [req.user?._id, '$subscribers.subscriber'],
            },
            then: true,
            else: false,
          },
        },
      },
      $project: {
        fullname: 1,
        username: 1,
        subscribedToCount: 1,
        subscribersCount: 1,
        isSubscribed: 1,
        email: 1,
      },
    },
  ]);

  if (!channel?.length) throw new ApiError(404, 'Channel Does Not Exist');

  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], 'User Channel Fetched Successfully'),
    );
});

const getWatchHistory = asyncHandler(async (req, res) => {
  // Alternative approach
  // if (req.user._id === 'string') {
  //   userId = new mongoose.Types.ObjectId(req.user._id);
  // } else if (req.user._id instanceof mongoose.Types.ObjectId) {
  //   userId = req.user._id;
  // } else if (typeof req.user._id === 'number') {
  //   userId = new mongoose.Types.ObjectId(req.user._id.toString());
  // }
  const user = await User.aggregate([
    {
      $match: {
        _id: mongoose.Types.createFromHexString(req.user._id),
      },
    },
    {
      $lookup: {
        from: 'videos',
        localField: 'watchHistory',
        foreignField: '_id',
        as: 'watchHistory',
        pipeline: [
          {
            $lookup: {
              from: 'users',
              localField: 'owner',
              foreignField: '_id',
              as: 'owner',
              pipeline: [
                {
                  $project: {
                    fullname: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: '$owner',
              },
            },
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        'Watch History Fetched Successfully',
      ),
    );
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory,
};
