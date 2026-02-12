import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { notify } from "./NotificationContext";
import { useAuth } from "./AuthContext";
import axiosInstance from "../services/axiosInstance";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const { user, setUser } = useAuth();

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
            message: "Tài khoản của bạn vừa đăng nhập từ thiết bị khác"
          });
          break;
        case "loggedOut": {
          const isGlobalLogout = !data?.id;
          const isThisSession = data?.id === user?.sessionId;

          if (isGlobalLogout || isThisSession) {
            notify({
              type: "info",
              title: "Tài khoản bị đăng xuất",
              message: "Phiên đăng nhập của bạn đã bị đăng xuất, vui lòng đăng nhập lại"
            });
          }

          break;
        }
        default:
          break;
      }
    }

    s.on("loggedInElsewhere", data => handleUpdate("LoggedInElsewhere", data));
    s.on("loggedOut", data => handleUpdate("loggedOut", data));

    return () => {
      s.off("loggedInElsewhere");
      s.off("loggedOut");
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