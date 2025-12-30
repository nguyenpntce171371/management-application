import axios from "axios";
import { notify } from "../context/NotificationContext";

let refreshPromise = null;
let refreshSubscribers = [];
let onAuthFailCallback = null;

export const setAuthFailHandler = (fn) => {
    onAuthFailCallback = fn;
};

const onRefreshed = () => {
    refreshSubscribers.forEach(cb => cb());
    refreshSubscribers = [];
};

const axiosInstance = axios.create({
    withCredentials: true,
    timeout: 30000,
});

axiosInstance.interceptors.response.use(
    (res) => {
        return res;
    },

    async (error) => {
        if (!error.response) {
            notify({
                type: "error",
                title: "Lỗi mạng",
                message: "Không thể kết nối máy chủ.",
            });
            return Promise.reject(error);
        }

        const originalRequest = error.config;
        const status = error.response.status;
        const code = error.response.data?.code;

        if (status === 401 && code === "TOKEN_EXPIRED" && !originalRequest._retry) {
            originalRequest._retry = true;

            if (!refreshPromise) {
                refreshPromise = axiosInstance
                    .post("/api/auth/refresh-token")
                    .then(() => {
                        onRefreshed();
                        return true;
                    })
                    .catch((err) => {
                        onRefreshed();
                        if (onAuthFailCallback) onAuthFailCallback();
                        throw err;
                    })
                    .finally(() => refreshPromise = null);
            }

            await refreshPromise;
            return axiosInstance(originalRequest);
        }

        if (
            (status === 401 &&
                (code === "REFRESH_EXPIRED" ||
                    code === "INVALID_TOKEN" ||
                    code === "NO_TOKEN")) ||
            (status === 400 && code === "NO_REFRESH_TOKEN")
        ) {
            if (onAuthFailCallback) onAuthFailCallback();
        }

        notify({
            type: "error",
            title: `Lỗi ${status}`,
            message: error.response.data?.message || "Đã có lỗi xảy ra.",
        });

        return Promise.reject(error);
    }
);

export default axiosInstance;
