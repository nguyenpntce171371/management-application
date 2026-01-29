
export const joinBaseRooms = (socket) => {
    const { id, role } = socket.user;
    socket.join(id);
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