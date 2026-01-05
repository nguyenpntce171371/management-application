import { BrowserRouter } from "react-router-dom";
import AppRouter from "./router/AppRouter";
import Layout from "./layouts/Layout";
import { AuthProvider } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import NotificationContainer from "./components/notification/NotificationContainer";
import { SocketProvider } from "./context/SocketContext";

const App = () => {
    return (
        <BrowserRouter>
            <AuthProvider>
                <SocketProvider>
                    <NotificationProvider>
                        <NotificationContainer />
                        <Layout>
                            <AppRouter />
                        </Layout>
                    </NotificationProvider>
                </SocketProvider>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;