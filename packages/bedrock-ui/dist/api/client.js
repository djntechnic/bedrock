import axios from "axios";
const API_BASE_URL = "";
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json"
  }
});
let _authToken = null;
function setAuthToken(token) {
  _authToken = token;
}
function getAuthToken() {
  return _authToken;
}
apiClient.interceptors.request.use((config) => {
  if (_authToken) {
    config.headers.set("Authorization", `Bearer ${_authToken}`);
  }
  return config;
});
export {
  apiClient,
  getAuthToken,
  setAuthToken
};
//# sourceMappingURL=client.js.map
