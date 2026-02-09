import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { notify } from "./NotificationContext";
import { useAuth } from "./AuthContext";
import axiosInstance from "../services/axiosInstance";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const { setUser } = useAuth();

  useEffect(() => {
    const s = io(window.location.origin, {
      path: "/socket.io/",
      transports: ["websocket"],
    });

    setSocket(s);

    const handleUpdate = async (type, data) => {
      const response = await axiosInstance.get("/api/user");
      setUser(response.data.data);

      switch (type) {
        case "LoggedInElsewhere":
          notify({
            type: "info",
            title: "Đăng nhập mới",
            message: "Tài khoản của bạn vừa đăng nhập từ thiết bị khác",
          });
          break;
        default:
          break;
      }
    }

    s.on("loggedInElsewhere", data => handleUpdate("LoggedInElsewhere", data));

    return () => {
      s.off("loggedInElsewhere");
      s.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  return useContext(SocketContext);
};