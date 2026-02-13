const naverApi = {
  clientID: process.env.NAVER_CLIENT_ID,
  clientSecret: process.env.NAVER_CLIENT_SECRET,
  newsSearchUrl: 'https://openapi.naver.com/v1/search/news.json'
};

module.exports = naverApi;