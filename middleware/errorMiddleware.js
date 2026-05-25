const notFound = (req, res, next) => {
    const err = new Error(`Nothing found at: ${req.originalUrl}`);
    res.status(404);
    next(err);
};

const errorHandler = (err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode);

    res.render("error", {
        message: err.message,
        stack: process.env.NODE_ENV === "production" ? null : err.stack
    });
};

module.exports = { notFound, errorHandler };
