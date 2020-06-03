import IHandler from "./handlers/handler";
import amqp, {ConsumeMessage} from "amqplib";
import {AmqpConfig} from "../common/types";
import * as url from "url";

class Listener {
    rabbitUrl: string;
    exchange: string;
    exchangeType: string;
    queue: string;
    routingKey: string;
    connection: any;
    channel: any;
    prefetch: number = 100;
    handler?: IHandler;

    constructor(amqpConfig: AmqpConfig) {
        const scheme = amqpConfig.connection.scheme;
        const host = amqpConfig.connection.host;
        const port = amqpConfig.connection.port;
        const rabbitUrl: URL = new url.URL(`${scheme}://${host}:${port}`);
        this.rabbitUrl = String(rabbitUrl);
        this.exchange = amqpConfig.messaging.exchange;
        this.exchangeType = amqpConfig.messaging.exchangeType;
        this.queue = amqpConfig.messaging.queueName;
        this.routingKey = amqpConfig.messaging.routingKey;
    }

    start() {
        return amqp.connect(this.rabbitUrl)
            .then(connection => (this.connection = connection).createChannel())
            .then(channel => {
                this.channel = channel;
                channel.prefetch(this.prefetch);
                return channel.assertQueue(this.queue, {durable: true})
                    .then(result => channel.consume(result.queue,
                    (message) => {
                        this.handle(message);
                    }, {noAck: false}))
            });
    }

    setHandler(handler: IHandler) {
        this.handler = handler;
    }

    handle(msg: ConsumeMessage | null): Promise<void> {
        return this.handler!.handle(msg!.content.toString())
            .then(success => {
                if (success) {
                    this.channel.ack(msg);
                } else {
                    console.info(`Failed to process message: \n ${msg!.content}`);
                    this.channel.nack(msg, false, false);
                }
            })
            .catch(err => {
                console.error(`Logging unexpected error: \n ${err.stack} \n ..for message: ${msg!.content}`);
                this.channel.nack(msg);
            });
        ;
    }

}

export default Listener;
