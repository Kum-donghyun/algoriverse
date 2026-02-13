// API Base URL 설정

// 환경변수에서 API URL 가져오기
// 개발 환경: http://localhost:5000/api (from .env.development)
// 프로덕션 환경: https://your-domain.com/api (from .env.production)
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Axios를 사용하는 경우 기본 설정
// src/utils/axios.js 또는 유사한 파일에서 사용

/*
import axios from 'axios';
import { API_BASE_URL } from './apiConfig';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true
});

export default apiClient;
*/

// 사용 예시:
/*
import apiClient from './utils/axios';

// GET 요청
const response = await apiClient.get('/news/search?keyword=정치');

// POST 요청
const response = await apiClient.post('/user/login', {
  username: 'user',
  password: 'pass'
});
*/
