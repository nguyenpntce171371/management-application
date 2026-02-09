import { useEffect, useState, useCallback } from "react";
import { User, Clock, Info, Shield, Calendar, Code } from "lucide-react";
import styles from "./LogPage.module.css";
import PageHeader from "../../components/layout/PageHeader";
import axiosInstance from "../../services/axiosInstance";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSocket } from "../../context/SocketContext";
import SearchField from "../../components/common/SearchField";
import Pagination from "../../components/common/Pagination";

function LogPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const socket = useSocket();

    const searchFromUrl = searchParams.get("search") || "";

    const [searchTerm, setSearchTerm] = useState(searchFromUrl);
    const [debouncedSearch, setDebouncedSearch] = useState(searchFromUrl);

    const [items, setItems] = useState([]);
    const [cursor, setCursor] = useState(null);
    const [direction, setDirection] = useState("next");
    const [nextCursor, setNextCursor] = useState(null);
    const [prevCursor, setPrevCursor] = useState(null);
    const [hasMore, setHasMore] = useState(false);
    const [hasPrev, setHasPrev] = useState(false);
    const limit = 21;

    useEffect(() => {
        setSearchTerm(searchFromUrl);
        setDebouncedSearch(searchFromUrl);
    }, [searchFromUrl]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            updateParams({ search: searchTerm });
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        setCursor(null);
        setDirection("next");
    }, [debouncedSearch]);

    const fetchData = useCallback(async () => {
        const res = await axiosInstance.get("/api/logs", {
            params: {
                limit,
                cursor,
                direction,
                search: debouncedSearch
            }
        });
        const { data, pagination } = res.data;
        setItems(data || []);
        setHasMore(!!pagination?.hasMore);
        setHasPrev(!!pagination?.hasPrev);
        setNextCursor(pagination?.nextCursor || null);
        setPrevCursor(pagination?.prevCursor || null);
    }, [limit, cursor, direction, debouncedSearch]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (!socket) return;

        const refresh = () => fetchData();

        socket.on("logCreated", refresh);

        return () => {
            socket.off("logCreated", refresh);
        };
    }, [socket, fetchData]);

    const updateParams = (newParams) => {
        const params = new URLSearchParams(searchParams);
        Object.entries(newParams).forEach(([key, value]) => {
            if (value === "" || value === "all") params.delete(key);
            else params.set(key, value);
        });
        navigate(`?${params.toString()}`);
    };

    const getLogType = (statusCode) => {
        if (statusCode >= 100 && statusCode < 400) return "success";
        if (statusCode >= 400 && statusCode < 600) return "error";
        return "info";
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("vi-VN");
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString("vi-VN");
    };

    const formatTimestamp = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return "Vừa xong";
        if (minutes < 60) return `${minutes} phút trước`;
        if (hours < 24) return `${hours} giờ trước`;
        if (days < 7) return `${days} ngày trước`;
        return date.toLocaleDateString("vi-VN");
    };

    const getLogTypeClass = (type) => {
        const types = {
            success: "success",
            error: "error"
        };
        return types[type] || "info";
    };

    const parseUserAgent = (userAgent = "") => {
        userAgent = userAgent.toLowerCase();

        let browser = "Unknown Browser";
        let os = "Unknown OS";

        if (userAgent.includes("chrome")) {
            const version = userAgent.match(/chrome\/([\d.]+)/)?.[1]?.split(".")[0];
            browser = `Chrome ${version}`;
        } else if (userAgent.includes("firefox")) {
            const version = userAgent.match(/firefox\/([\d.]+)/)?.[1]?.split(".")[0];
            browser = `Firefox ${version}`;
        } else if (userAgent.includes("safari") && !userAgent.includes("chrome")) {
            const version = userAgent.match(/version\/([\d.]+)/)?.[1]?.split(".")[0];
            browser = `Safari ${version}`;
        } else if (userAgent.includes("edg")) {
            const version = userAgent.match(/edg\/([\d.]+)/)?.[1]?.split(".")[0];
            browser = `Edge ${version}`;
        }

        if (userAgent.includes("windows nt 10")) os = "Windows 10";
        else if (userAgent.includes("windows nt 6.1")) os = "Windows 7";
        else if (userAgent.includes("mac os x")) os = "macOS";
        else if (userAgent.includes("android")) os = "Android";
        else if (userAgent.includes("iphone")) os = "iOS";

        return `${browser} · ${os}`;
    }

    return (
        <>
            <PageHeader title="Quản lý Log hệ thống" />
            <div className={styles.content}>
                <div className={styles.searchFilterBar}>
                    <SearchField searchTerm={searchTerm} setSearchTerm={setSearchTerm} placeholder="Tìm kiếm logs..." />
                </div>

                <div className={styles.logsTimeline}>
                    {(items ?? []).map((log) => {
                        const logType = getLogType(log.statusCode);

                        return (
                            <div key={log.id} className={`${styles.logItem} ${styles[`logItem${getLogTypeClass(logType).charAt(0).toUpperCase() + getLogTypeClass(logType).slice(1)}`]}`}>
                                <div className={styles.logContent}>
                                    <div className={styles.logHeader}>
                                        <div className={styles.logHeaderLeft}>
                                            <h4 className={styles.logAction}>{log.method} {log.endpoint}</h4>
                                            <span className={`${styles.logType} ${styles[`logType${getLogTypeClass(logType).charAt(0).toUpperCase() + getLogTypeClass(logType).slice(1)}`]}`}>
                                                {log.statusCode}
                                            </span>
                                        </div>
                                        <span className={styles.logTimestamp}>
                                            {formatTimestamp(log.createdAt)}
                                        </span>
                                    </div>

                                    <p className={styles.logDescription}>{log.message}</p>

                                    <div className={styles.logMeta} style={{ paddingBottom: "0.25rem", borderBottomLeftRadius: "0px", borderBottomRightRadius: "0px" }}>
                                        {log.email && (
                                            <div className={styles.logMetaItem}>
                                                <User className={styles.metaIcon} />
                                                <span>{log.email}</span>
                                            </div>
                                        )}
                                        {log.role && (
                                            <div className={styles.logMetaItem}>
                                                <User className={styles.metaIcon} />
                                                <span>{log.role}</span>
                                            </div>
                                        )}
                                        {log.userAgent && (
                                            <div className={styles.logMetaItem}>
                                                <Code className={styles.metaIcon} />
                                                <span>{parseUserAgent(log.userAgent)}</span>
                                            </div>
                                        )}
                                        <div className={styles.logMetaItem}>
                                            <Clock className={styles.metaIcon} />
                                            <span>{formatTime(log.createdAt)}</span>
                                        </div>
                                        <div className={styles.logMetaItem}>
                                            <Calendar className={styles.metaIcon} />
                                            <span>{formatDate(log.createdAt)}</span>
                                        </div>
                                        <div className={styles.logMetaItem}>
                                            <Shield className={styles.metaIcon} />
                                            <span>{log.ipAddress}</span>
                                        </div>
                                    </div>

                                    {log.referrer && (
                                        <div className={styles.logMeta} style={{ paddingTop: "0.25rem", borderTopLeftRadius: "0px", borderTopRightRadius: "0px" }}>
                                            <div className={styles.logMetaItem}>
                                                <Info className={styles.metaIcon} />
                                                <span style={{ fontSize: "0.85em" }}>From: {log.referrer}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <Pagination prevCursor={prevCursor} nextCursor={nextCursor} hasPrev={hasPrev} hasMore={hasMore} setCursor={setCursor} setDirection={setDirection} />
            </div>
        </>
    );
}

export default LogPage;