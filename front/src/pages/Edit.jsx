import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/Edit.css';

const Edit = () => {
    const [step, setStep] = useState('confirmPassword'); // 'confirmPassword', 'editForm', 'error'
    const [password, setPassword] = useState('');
    const [userData, setUserData] = useState(null);
    const [formData, setFormData] = useState({});
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
                // Assuming an endpoint to get the current user's data
                const response = await axios.get('http://localhost:5000/api/user/me', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setUserData(response.data);
                // Initialize form data, excluding ID and RECOMMEND
                const { USER_ID, RECOMMEND, ...editableData } = response.data;
                setFormData(editableData);
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
                setError('로그인이 필요합니다.'); // Should ideally not happen if 'me' call was successful
                return;
            }

            await axios.post('http://localhost:5000/api/user/check-password', {
                USER_ID: userData.USER_ID,
                PW: password
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStep('editForm'); // Password is correct, move to next step
        } catch (err) {
            setError('비밀번호가 일치하지 않습니다.');
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleUpdateSubmit = async (e) => {
        e.preventDefault();
        
        try {
            const token = localStorage.getItem('token');
            // We need to send the USER_ID to identify which user to update
            const updatePayload = { ...formData, USER_ID: userData.USER_ID };

            await axios.put('http://localhost:5000/api/user/update', updatePayload, {
                 headers: { Authorization: `Bearer ${token}` }
            });

            alert('회원 정보가 성공적으로 수정되었습니다.');
            // Optionally, refresh user data or redirect
        } catch (err) {
            alert('정보 수정에 실패했습니다. 다시 시도해주세요.');
            console.error('Update error:', err);
        }
    };

    if (step === 'error') {
        return <div className="edit-container"><h2>오류</h2><p>{error}</p></div>;
    }

    if (step === 'confirmPassword') {
        return (
            <div className="edit-container">
                <h2>비밀번호 확인</h2>
                <p>회원 정보를 안전하게 보호하기 위해 비밀번호를 다시 한 번 입력해주세요.</p>
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

    if (step === 'editForm' && formData) {
        return (
            <div className="edit-container">
                <h2>회원 정보 수정</h2>
                {userData && (
                    <div className="edit-input-group">
                        <label>아이디</label>
                        <p className="read-only-field">{userData.USER_ID}</p>
                    </div>
                )}
                <form onSubmit={handleUpdateSubmit} className="edit-form">
                    <label>비밀번호</label>
                    <input type="password" name="PW" value={formData.PW || ''} onChange={handleInputChange} />

                    <label>이름</label>
                    <input type="text" name="NICK" value={formData.NICK || ''} onChange={handleInputChange} />

                    <label>이메일</label>
                    <input type="email" name="EMAIL" value={formData.EMAIL || ''} onChange={handleInputChange} />
                    


                    <button type="submit">수정하기</button>
                </form>
            </div>
        );
    }

    return <div className="edit-container"><h2>로딩 중...</h2></div>; // Loading or default state
};

export default Edit;
