const { validationResult } = require("express-validator");
const { StatusCodes } = require("http-status-codes");

const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (errors.array().length > 0) {
        return res
            .status(StatusCodes.BAD_REQUEST)
            .json({ success: false, message: errors.array()[0].msg });
    }
    next();
};

module.exports = validateRequest;