import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App as AntApp, ConfigProvider } from "antd";
import { StyleProvider } from "@ant-design/cssinjs";
import App from "./App";
import "./index.css";
import { AppConfig } from "./config";
import { antdTheme } from "./theme/antdTheme";

async function bootstrap() {
  await AppConfig.init();
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <StyleProvider layer hashPriority="high">
        <ConfigProvider theme={antdTheme}>
          <AntApp>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </AntApp>
        </ConfigProvider>
      </StyleProvider>
    </React.StrictMode>,
  );
}

bootstrap();
