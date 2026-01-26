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
        case "LoggedOut":
          notify({
            type: "warning",
            title: "Đã đăng xuất",
            message: "Phiên đăng nhập của bạn đã kết thúc",
          });
          break;
        case "SessionLoggedOut":
          if (data.sessionIds?.length > 0) {
            notify({
              type: "warning",
              title: "Đã đăng xuất",
              message: "Tất cả phiên đăng nhập đã được thu hồi",
            });
          }
          break;
        case "LoggedInElsewhere":
          notify({
            type: "info",
            title: "Đăng nhập mới",
            message: "Tài khoản của bạn vừa đăng nhập từ thiết bị khác",
          });
          break;
        case "AccountDeleted":
          notify({
            type: "error",
            title: "Tài khoản đã bị xóa",
            message: "Tài khoản của bạn đã bị xóa vĩnh viễn. Bạn sẽ được đăng xuất sau 3 giây.",
          });
          break;
        case "RoleUpdated":
          notify({
            type: "info",
            title: "Vai trò đã thay đổi",
            message: "Vai trò của bạn đã được thay đổi.",
          });
          break;
        default:
          break;
      }
    }

    s.on("loggedOut", data => handleUpdate("LoggedOut", data));
    s.on("loggedInElsewhere", data => handleUpdate("LoggedInElsewhere", data));
    s.on("sessionLoggedOut", data => handleUpdate("SessionLoggedOut", data));
    s.on("accountDeleted", data => handleUpdate("AccountDeleted", data));
    s.on("roleUpdated", data => handleUpdate("RoleUpdated", data))

    return () => {
      s.off("loggedOut");
      s.off("sessionLoggedOut");
      s.off("loggedInElsewhere");
      s.off("accountDeleted");
      s.off("roleUpdated")
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