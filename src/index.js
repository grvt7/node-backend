import dotenv from 'dotenv';
import connectDB from './db/index.js';
import { app } from './app.js';

dotenv.config({
  path: './.env',
});

connectDB()
  .then(() => {
    try {
      app.listen(process.env.PORT || 8000, () => {
        console.log(`Server is running @ port :: ${process.env.PORT}`);
      });
    } catch (error) {
      console.log(`Failed to start server !!! ${error}`);
    }
  })
  .catch((error) => {
    console.log('MongoDb connection failed !!!', error);
  });
