import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/Delete.css'; // Assuming a similar CSS structure as Edit.css

const Delete = () => {
    const [step, setStep] = useState('confirmPassword'); // 'confirmPassword', 'deleteConfirm', 'error', 'success'
    const [password, setPassword] = useState('');
    const [userData, setUserData] = useState(null);
    const [error, setError] = useState('');

    // Fetch current user's data when component mounts
    useEffect(() => {
        const fetchUserData = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                setError('로그인이 필요합니다.');
                setStep('error');
                return;
            }

            try {
                const response = await axios.get('http://localhost:5000/api/user/me', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setUserData(response.data);
            } catch (err) {
                setError('사용자 정보를 불러오는 데 실패했습니다.');
                setStep('error');
            }
        };

        fetchUserData();
    }, []);

    const handlePasswordConfirm = async (e) => {
        e.preventDefault();
        if (!userData) {
            setError('사용자 정보를 먼저 불러와야 합니다.');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setError('로그인이 필요합니다.');
                return;
            }

            await axios.post('http://localhost:5000/api/user/check-password', {
                USER_ID: userData.USER_ID,
                PW: password
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStep('deleteConfirm'); // Password is correct, move to delete confirmation step
        } catch (err) {
            setError('비밀번호가 일치하지 않습니다.');
        }
    };

    const handleDeleteAccount = async (e) => {
        e.preventDefault();
        
        if (!window.confirm('정말로 회원 탈퇴를 하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setError('로그인이 필요합니다.');
                return;
            }

            // The backend uses req.user.USER_ID from the token, so no need to send USER_ID in body
            await axios.delete('http://localhost:5000/api/user/delete', {
                headers: { Authorization: `Bearer ${token}` }
            });

            localStorage.removeItem('token'); // Clear token on successful deletion
            setStep('success');
            // Optionally, redirect to a login/home page
        } catch (err) {
            setError('회원 탈퇴 중 오류가 발생했습니다.');
            console.error('Delete error:', err);
        }
    };

    if (step === 'error') {
        return <div className="delete-container"><h2>오류</h2><p>{error}</p></div>;
    }

    if (step === 'success') {
        return <div className="delete-container"><h2>회원 탈퇴 완료</h2><p>성공적으로 회원 탈퇴가 완료되었습니다.</p></div>;
    }

    if (step === 'confirmPassword') {
        return (
            <div className="delete-container">
                <h2>비밀번호 확인</h2>
                <p>회원 탈퇴를 위해 비밀번호를 다시 한 번 입력해주세요.</p>
                <form onSubmit={handlePasswordConfirm} className="password-confirm-form">
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="비밀번호"
                        required
                    />
                    <button type="submit">확인</button>
                    {error && <p className="error-message">{error}</p>}
                </form>
            </div>
        );
    }

    if (step === 'deleteConfirm' && userData) {
        return (
            <div className="delete-container">
                <h2>회원 탈퇴</h2>
                <p>회원 탈퇴 전 다음 정보를 확인해주세요.</p>
                {userData && (
                    <div className="edit-input-group"> {/* Reusing class from Edit for styling consistency */}
                        <label>아이디</label>
                        <p className="read-only-field">{userData.USER_ID}</p>
                    </div>
                )}
                <p className="warning-message">
                    회원 탈퇴 시 모든 정보가 삭제되며, 복구할 수 없습니다.
                    정말로 탈퇴하시겠습니까?
                </p>
                <button onClick={handleDeleteAccount} className="delete-account-btn">회원 탈퇴</button>
                {error && <p className="error-message">{error}</p>}
            </div>
        );
    }

    return <div className="delete-container"><h2>로딩 중...</h2></div>; // Loading or default state
};

export default Delete;