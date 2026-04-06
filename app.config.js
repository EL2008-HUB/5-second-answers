const os = require("os");
const appJson = require("./app.json");

const isPrivateIpv4 = (value = "") =>
  /^10\./.test(value) ||
  /^192\.168\./.test(value) ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(value);

const getLocalIpv4 = () => {
  const interfaces = os.networkInterfaces();

  for (const addresses of Object.values(interfaces)) {
    if (!Array.isArray(addresses)) {
      continue;
    }

    for (const address of addresses) {
      if (
        address &&
        address.family === "IPv4" &&
        !address.internal &&
        isPrivateIpv4(address.address)
      ) {
        return address.address;
      }
    }
  }

  return null;
};

module.exports = () => {
  const localIp = getLocalIpv4();
  const apiUrl =
    String(process.env.EXPO_PUBLIC_API_URL || "").trim() ||
    (localIp ? `http://${localIp}:5000` : "http://localhost:5000");
  const appEnv = String(process.env.EXPO_PUBLIC_APP_ENV || "").trim() || "development";

  return {
    ...appJson.expo,
    extra: {
      ...(appJson.expo.extra || {}),
      apiUrl,
      appEnv,
      localIp,
    },
  };
};
