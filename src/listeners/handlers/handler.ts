type AmqpMessage = {messageBytes: string};

interface IHandler {
    handle(msg: string): Promise<boolean>;
}

export default IHandler;
export {AmqpMessage, IHandler};
