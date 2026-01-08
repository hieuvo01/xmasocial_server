    // middleware/errorMiddleware.js

    const notFound = (req, res, next) => {
      const error = new Error(`Not Found - ${req.originalUrl}`);
      res.status(404);
      next(error);
    };

    const errorHandler = (err, req, res, next) => {
      // Nếu status code là 200 (OK) nhưng thực sự có lỗi, chuyển thành 500 (Internal Server Error)
      const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
      res.status(statusCode);

      // Ghi log lỗi chi tiết ra console của server
      console.error('SERVER ERROR DETAILS:');
      console.error(`  Status: ${statusCode}`);
      console.error(`  Message: ${err.message}`);
      if (process.env.NODE_ENV === 'development') {
        console.error('  Stack Trace:');
        console.error(err.stack); // Chỉ hiển thị stack trace trong môi trường dev
      } else {
        console.error('  (Stack trace hidden in production)');
      }
      console.error('------------------------------------');

      // Trả về JSON lỗi cho client (Flutter)
      res.json({
        message: err.message,
        // Chỉ hiển thị stack trace trong môi trường dev cho Flutter
        stack: process.env.NODE_ENV === 'development' ? err.stack : null,
      });
    };

    export { notFound, errorHandler };
