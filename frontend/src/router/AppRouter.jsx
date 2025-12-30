import { Routes, Route } from "react-router-dom";
import { Suspense } from "react";
import "../assets/css/global.css";
import ProtectedRoute from "./ProtectedRoute";
import HomePage from "../pages/home/HomePage";
import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";
import ForgotPassword from "../pages/auth/ForgotPassword";
import Profile from "../pages/user/Profile";
import NotFound from "../pages/notfound/NotFound";
import UserManagement from "../pages/admin/UserManagement";
import GuestRoute from "./GuestRoute";
import RealEstate from "../pages/staff/RealEstate";
import RealEstateDetail from "../pages/staff/RealEstateDetail";
import AdminPage from "../pages/admin/AdminPage";
import StaffPage from "../pages/staff/StaffPage";
import LogPage from "../pages/admin/LogPage";
import UserPage from "../pages/user/UserPage";
import AddRealEstate from "../pages/user/AddRealEstate";
import UnauthorizedPage from "../pages/unauthorized/UnauthorizedPage";
import PropertyValuation from "../pages/staff/PropertyValuation";
import PropertyValuationDetail from "../pages/staff/PropertyValuationDetail";
import AppraisalWorksheet from "../components/sheet/AppraisalWorksheet";

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
                <Route path="/user" element={
                    <ProtectedRoute role="User">
                        <UserPage />
                    </ProtectedRoute>
                } />
                <Route path="/user/add-real-estate" element={
                    <ProtectedRoute role="User">
                        <AddRealEstate />
                    </ProtectedRoute>
                } />
                <Route path="/profile" element={
                    <ProtectedRoute role="User">
                        <Profile />
                    </ProtectedRoute>
                } />
                <Route path="/staff" element={
                    <ProtectedRoute role="Staff">
                        <StaffPage />
                    </ProtectedRoute>
                } />
                <Route path="/staff/real-estate" element={
                    <ProtectedRoute role="Staff">
                        <RealEstate />
                    </ProtectedRoute>
                } />
                <Route path="/staff/real-estate/:id" element={
                    <ProtectedRoute role="Staff">
                        <RealEstateDetail />
                    </ProtectedRoute>
                } />
                <Route path="/staff/property-valuation" element={
                    <ProtectedRoute role="staff">
                        <PropertyValuation />
                    </ProtectedRoute>
                } />
                <Route path="/staff/property-valuation/:id" element={
                    <ProtectedRoute role="Staff">
                        <PropertyValuationDetail />
                    </ProtectedRoute>
                } />
                <Route path="/staff/appraisal-worksheet/:id" element={
                    <ProtectedRoute role="Staff">
                        <AppraisalWorksheet />
                    </ProtectedRoute>
                } />

                <Route path="/admin" element={
                    <ProtectedRoute role="Admin">
                        <AdminPage />
                    </ProtectedRoute>
                } />
                <Route path="/admin/user-management" element={
                    <ProtectedRoute role="Admin">
                        <UserManagement />
                    </ProtectedRoute>
                } />
                <Route path="/admin/log" element={
                    <ProtectedRoute role="Admin">
                        <LogPage />
                    </ProtectedRoute>
                } />
                <Route path="*" element={<NotFound />} />
            </Routes>
        </Suspense>
    );
}

export default AppRouter;
