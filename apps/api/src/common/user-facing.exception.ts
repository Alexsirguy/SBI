import { HttpException } from "@nestjs/common";

// Only these messages reach clients; framework errors can quote the request body back.
export class UserFacingException extends HttpException {}
