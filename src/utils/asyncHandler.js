const asyncHandler = (requestHandler) => {
  (err, req, res, next) => {
    Promise.resolve(requestHandler(err, req, res, next)).catch((error) =>
      next(error)
    );
  };
};

export default asyncHandler;

// Understanding the how higher order async handler works
// const asyncHandler = () => {};
// const asyncHandler = (func) => {() => {}};
// const asyncHandler = (func) => () => {};
// const asyncHandler = (func) => async () => {};

// One of the ways to handle this
// const asyncHandler = (func = async (err, req, res, next) => {
//   try {
//     await func(err, req, res, next)
//   } catch (error) {
//     res.status(err.code || 500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// });
