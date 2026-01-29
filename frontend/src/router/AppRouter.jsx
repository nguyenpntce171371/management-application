import { Routes, Route } from "react-router-dom";
import { Suspense } from "react";
import "../assets/css/global.css";
import GuestRoute from "./GuestRoute";
import ProtectedRoute from "./ProtectedRoute";
import HomePage from "../pages/home/HomePage";
import UnauthorizedPage from "../pages/403/UnauthorizedPage";
import Login from "../pages/auth/login/Login";
import Register from "../pages/auth/register/Register";
import ForgotPassword from "../pages/auth/forgot-password/ForgotPassword";
import RealEstate from "../pages/real-estates/RealEstate";
import RealEstateDetail from "../pages/real-estates/detail/RealEstateDetail";
import AddRealEstate from "../pages/real-estates/add/AddRealEstate";
import Profile from "../pages/user/Profile";
import PropertyValuation from "../pages/apprisals/PropertyValuation";
import PropertyValuationDetail from "../pages/apprisals/detail/PropertyValuationDetail";
import AppraisalWorksheet from "../pages/apprisals/detail/worksheet/AppraisalWorksheet";
import UserManagement from "../pages/users/UserManagement";
import LogPage from "../pages/logs/LogPage";
import BackupManagement from "../pages/backups/BackupManagement";
import NotFound from "../pages/not-found/NotFound";
import DeletedItemsManagement from "../pages/trashs/DeletedItemsManagement";

function AppRouter() {
    return (
        <Suspense fallback={<div style={{ color: "white" }}>Đang tải...</div>}>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/403" element={<UnauthorizedPage />} />
                <Route path="/login" element={
                    <GuestRoute>
                        <Login />
                    </GuestRoute>
                } />
                <Route path="/register" element={
                    <GuestRoute>
                        <Register />
                    </GuestRoute>
                } />
                <Route path="/forgot-password" element={
                    <GuestRoute>
                        <ForgotPassword />
                    </GuestRoute>
                } />
                <Route path="/real-estates" element={
                    <ProtectedRoute role="User">
                        <RealEstate />
                    </ProtectedRoute>
                } />
                <Route path="/real-estates/add" element={
                    <ProtectedRoute role="User">
                        <AddRealEstate />
                    </ProtectedRoute>
                } />
                <Route path="/real-estates/:id" element={
                    <ProtectedRoute role="User">
                        <RealEstateDetail />
                    </ProtectedRoute>
                } />
                <Route path="/profile" element={
                    <ProtectedRoute role="User">
                        <Profile />
                    </ProtectedRoute>
                } />
                <Route path="/appraisals" element={
                    <ProtectedRoute role="Staff">
                        <PropertyValuation />
                    </ProtectedRoute>
                } />
                <Route path="/appraisals/:id"
                    element={
                        <ProtectedRoute role="Staff">
                            <PropertyValuationDetail />
                        </ProtectedRoute>
                    }>
                    <Route path="worksheet" element={
                        <ProtectedRoute role="Staff">
                            <AppraisalWorksheet />
                        </ProtectedRoute>
                    } />
                </Route>
                <Route path="/users" element={
                    <ProtectedRoute role="Admin">
                        <UserManagement />
                    </ProtectedRoute>
                } />
                <Route path="/logs" element={
                    <ProtectedRoute role="Admin">
                        <LogPage />
                    </ProtectedRoute>
                } />
                <Route path="/backups" element={
                    <ProtectedRoute role="Admin">
                        <BackupManagement />
                    </ProtectedRoute>
                } />
                <Route path="/trashs" element={
                    <ProtectedRoute role="Admin">
                        <DeletedItemsManagement />
                    </ProtectedRoute>
                } />
                <Route path="*" element={<NotFound />} />
            </Routes>
        </Suspense>
    );
}

export default AppRouter;
