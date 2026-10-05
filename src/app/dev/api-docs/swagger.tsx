"use client";
import dynamic from "next/dynamic";
import spec from "../../../../docs/api/openapi.json";
import "swagger-ui-react/swagger-ui.css";
import { sameOriginRequest } from "./policy";
const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });
// The React wrapper omits validatorUrl; disable its constructor default through a plugin.
const disableRemoteValidator = {
  afterLoad(system: unknown) {
    if (
      !system ||
      typeof system !== "object" ||
      !("getConfigs" in system) ||
      typeof system.getConfigs !== "function"
    )
      throw new Error("Invalid API console configuration.");
    const config: unknown = system.getConfigs();
    if (!config || typeof config !== "object")
      throw new Error("Invalid API console configuration.");
    (config as Record<string, unknown>).validatorUrl = null;
  },
};
const consoleSecurity = { withCredentials: false };
export default function ApiDocs() {
  return (
    <SwaggerUI
      spec={spec}
      {...consoleSecurity}
      plugins={[disableRemoteValidator]}
      persistAuthorization={false}
      supportedSubmitMethods={["get", "post", "patch", "delete"]}
      requestInterceptor={(request: unknown) => {
        if (
          !request ||
          typeof request !== "object" ||
          !("url" in request) ||
          typeof request.url !== "string"
        )
          throw new Error("Invalid API console request.");
        return sameOriginRequest(
          { ...request, url: request.url },
          window.location.origin,
        );
      }}
    />
  );
}
