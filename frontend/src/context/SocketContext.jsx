import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { notify } from "./NotificationContext";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const s = io(window.location.origin, {
      path: "/socket.io/",
      transports: ["websocket"],
    });

    setSocket(s);

    const handleLoggedOut = (data) => {
      notify({
        type: "warning",
        title: "Đã đăng xuất",
        message: "Phiên đăng nhập của bạn đã kết thúc",
      });
    };

    const handleSessionLoggedOut = (data) => {
      if (data.sessionIds?.length > 0) {
        notify({
          type: "warning",
          title: "Đã đăng xuất",
          message: "Tất cả phiên đăng nhập đã được thu hồi",
        });
      }
    };

    const handleLoggedInElsewhere = (data) => {
      notify({
        type: "info",
        title: "Đăng nhập mới",
        message: "Tài khoản của bạn vừa đăng nhập từ thiết bị khác",
      });
    };

    const handleAccountDeleted = (data) => {
      notify({
        type: "error",
        title: "Tài khoản đã bị xóa",
        message: "Tài khoản của bạn đã bị xóa vĩnh viễn. Bạn sẽ được đăng xuất sau 3 giây.",
      });
    };

    s.on("loggedOut", handleLoggedOut);
    s.on("loggedInElsewhere", handleLoggedInElsewhere);
    s.on("sessionLoggedOut", handleSessionLoggedOut);
    s.on("accountDeleted", handleAccountDeleted);

    return () => {
      s.off("loggedOut", handleLoggedOut);
      s.off("loggedInElsewhere", handleLoggedInElsewhere);
      s.off("sessionLoggedOut", handleSessionLoggedOut);
      s.off("accountDeleted", handleAccountDeleted);

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