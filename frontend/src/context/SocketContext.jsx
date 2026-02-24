import { createContext, useContext, useEffect, useRef } from "react";
import { notify } from "./NotificationContext";
import { useAuth } from "./AuthContext";
import axiosInstance from "../services/axiosInstance";
import socket from "../services/socketInstance";

const SocketContext = createContext(socket);

export const SocketProvider = ({ children }) => {
  const { user, setUser } = useAuth();
  const userRef = useRef(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    const handleLoggedInElsewhere = async () => {
      const response = await axiosInstance.get("/api/user");
      setUser(response.data.data);
      notify({
        type: "info",
        title: "Đăng nhập mới",
        message: "Tài khoản của bạn vừa đăng nhập từ thiết bị khác"
      });
    };

    const handleLoggedOut = async (data) => {
      const response = await axiosInstance.get("/api/user");
      setUser(response.data.data);

      const isGlobalLogout = !data?.id;
      const isThisSession = data?.id === userRef.current?.sessionId;

      if (isGlobalLogout || isThisSession) {
        notify({
          type: "info",
          title: "Tài khoản bị đăng xuất",
          message: "Phiên đăng nhập của bạn đã bị đăng xuất, vui lòng đăng nhập lại"
        });
      }
    };

    socket.on("loggedInElsewhere", handleLoggedInElsewhere);
    socket.on("loggedOut", handleLoggedOut);

    return () => {
      socket.off("loggedInElsewhere", handleLoggedInElsewhere);
      socket.off("loggedOut", handleLoggedOut);
    };
  }, [setUser]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);