import { BrowserRouter } from "react-router-dom";
import AppRouter from "./router/AppRouter";
import Layout from "./layouts/Layout";
import { AuthProvider } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import NotificationContainer from "./components/notification/NotificationContainer";

const App = () => {
    return (
        <BrowserRouter>
            <AuthProvider>
                <NotificationProvider>
                    <NotificationContainer />
                    <Layout>
                        <AppRouter />
                    </Layout>
                </NotificationProvider>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;