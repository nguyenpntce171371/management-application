import { redis } from "../middlewares/rateLimitRedis.js";
import crypto from "crypto";

const OTP_EXPIRY = 300;
const MAX_ATTEMPTS = 3;
const RESEND_COOLDOWN = 60;
const RATE_LIMIT_WINDOW = 3600;
const MAX_OTP_PER_HOUR = 5;
const RESET_TOKEN_EXPIRY = 600;

export class OTPService {

    static generateCode() {
        return crypto.randomInt(100000, 999999).toString();
    }

    static hashCode(code) {
        return crypto.createHash("sha256").update(code).digest("hex");
    }

    static async checkRateLimit(identifier) {
        const key = `otp:ratelimit:${identifier}`;
        const count = await redis.incr(key);

        if (count === 1) {
            await redis.expire(key, RATE_LIMIT_WINDOW);
        }

        if (count > MAX_OTP_PER_HOUR) {
            const ttl = await redis.ttl(key);
            const error = new Error(`Bạn đã gửi quá nhiều OTP. Vui lòng thử lại sau ${Math.ceil(ttl / 60)} phút`);
            error.code = "OTP_LIMIT";
            throw error;
        }
    }

    static async create(identifier, purpose) {
        const cooldownKey = `otp:${purpose}:${identifier}:cooldown`;

        const cooldown = await redis.get(cooldownKey);
        if (cooldown) {
            const error = new Error("Vui lòng đợi 1 phút trước khi gửi lại OTP");
            error.code = "OTP_LIMIT";
            throw error;
        }

        await this.checkRateLimit(identifier);

        const code = this.generateCode();
        const hashedCode = this.hashCode(code);

        const otpKey = `otp:${purpose}:${identifier}:code`;
        const attemptsKey = `otp:${purpose}:${identifier}:attempts`;

        await redis.setex(otpKey, OTP_EXPIRY, hashedCode);
        await redis.setex(attemptsKey, OTP_EXPIRY, MAX_ATTEMPTS);
        await redis.setex(cooldownKey, RESEND_COOLDOWN, "1");

        return {
            code,
            expiresIn: OTP_EXPIRY,
            attemptsLeft: MAX_ATTEMPTS
        };
    }

    static async verify(identifier, inputCode, purpose) {
        const otpKey = `otp:${purpose}:${identifier}:code`;
        const attemptsKey = `otp:${purpose}:${identifier}:attempts`;

        const error = new Error("");

        const savedHashedCode = await redis.get(otpKey);
        if (!savedHashedCode) {
            error.message = "Mã OTP đã hết hạn hoặc không tồn tại";
            error.code = "OTP_ERROR";
            throw error;
        }

        let attempts = parseInt(await redis.get(attemptsKey)) || 0;
        if (attempts <= 0) {
            await this.invalidate(identifier, purpose);
            error.message = "Bạn đã nhập sai quá nhiều lần. Vui lòng yêu cầu OTP mới";
            error.code = "OTP_LIMIT";
            throw error;
        }

        const hashedInput = this.hashCode(inputCode);
        if (savedHashedCode !== hashedInput) {
            await redis.decr(attemptsKey);
            error.message = `Mã OTP không đúng. Còn ${attempts - 1} lần thử`;
            error.code = "OTP_LIMIT";
            throw error;
        }

        await redis.del(otpKey);
        await redis.del(attemptsKey);
        await redis.del(`otp:${purpose}:${identifier}:cooldown`);

        const resetToken = crypto.randomBytes(32).toString("hex");
        const hashedToken = this.hashCode(resetToken);

        await redis.setex(
            `otp:${purpose}:${identifier}:token`,
            RESET_TOKEN_EXPIRY,
            hashedToken
        );

        return resetToken;
    }

    static async isVerified(identifier, inputToken = null, purpose) {
        if (inputToken) {
            const savedToken = await redis.get(`otp:${purpose}:${identifier}:token`);
            if (!savedToken) return false;

            return savedToken === this.hashCode(inputToken);
        } else {
            const verified = await redis.get(`otp:${purpose}:${identifier}:verified`);
            return verified === "true";
        }
    }

    static async clearVerified(identifier, purpose) {
        await redis.del(`otp:${purpose}:${identifier}:token`);
        await redis.del(`otp:${purpose}:${identifier}:verified`);
    }

    static async invalidate(identifier, purpose) {
        await redis.del(
            `otp:${purpose}:${identifier}:code`,
            `otp:${purpose}:${identifier}:attempts`,
            `otp:${purpose}:${identifier}:cooldown`
        );
    }

    static async getInfo(identifier, purpose) {
        const otpKey = `otp:${purpose}:${identifier}:code`;
        const attemptsKey = `otp:${purpose}:${identifier}:attempts`;

        const [ttl, attempts] = await Promise.all([
            redis.ttl(otpKey),
            redis.get(attemptsKey)
        ]);

        return {
            exists: ttl > 0,
            expiresIn: ttl > 0 ? ttl : 0,
            attemptsLeft: parseInt(attempts) || 0
        };
    }
}