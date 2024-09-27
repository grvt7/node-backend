import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloud = async (localFilePath) => {
  try {
    if (!localFilePath) return null;
    // Upload file on cloud
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: 'auto',
    });
    // Success
    console.log(`File is uploaded on the cloud: ${response.url}`);
    return response;
  } catch (error) {
    fs.unlinkSync(localFilePath); // Removes local file from server on fail
    return null;
  }
};

export default uploadOnCloud;
