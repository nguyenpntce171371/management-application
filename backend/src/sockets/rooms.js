export const joinBaseRooms = (socket) => {
    const { userId, role } = socket.user;
    socket.join(userId);
    switch (role) {
        case "Admin":
            socket.join("Admin");
        case "Staff":
            socket.join("Staff");
        case "User":
            socket.join("User");
            break;
        default:
            break;
    }
};