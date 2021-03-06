import request from "request-promise";
import Promise from "bluebird";
import ITokenClient from "./token-client";
import {AAPCredentials} from "../common/types";

class AapTokenClient implements ITokenClient {
    aapCredentials: AAPCredentials;
    authUrl: string;

    constructor(aapCredentials: AAPCredentials, authUrl: string) {
        this.aapCredentials = aapCredentials;
        this.authUrl = authUrl;
    }

    /**
     *
     * Retrieves a token from AAP using HTTP Authentication with a username and password
     */
    retrieveToken() : Promise<string> {
        return request({
                method: "GET",
                url: this.authUrl,
                auth: this.aapCredentials
            }).then((response:string) => Promise.resolve(response))
    }
}

export default AapTokenClient;
