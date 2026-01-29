import convert from "../services/address.service.js";

export const convertAddress = async (req, res) => {
    try {
        const address = req.body.address;
        const newAddress = convert(address);
        return res.status(200).json({
            success: true,
            code: "SUCCESS",
            data: {
                old: address,
                new: newAddress
            }
        });
    } catch (error) {
        console.error("Convert Address Error:", err);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};