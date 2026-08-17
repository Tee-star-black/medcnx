import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, {
  type SendMailOptions,
  type Transporter,
} from 'nodemailer';

type SendMailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
};

type MailError = {
  message?: string;
  code?: string;
  response?: string;
  responseCode?: number;
  command?: string;
  stack?: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(
    MailService.name,
  );

  private readonly transporter: Transporter | null;
  private readonly configured: boolean;
  private readonly fromName: string;
  private readonly fromEmail: string;

  constructor(
    private readonly configService: ConfigService,
  ) {
    const host =
      this.configService
        .get<string>('MAIL_HOST')
        ?.trim() ?? '';

    const port = Number(
      this.configService.get<string>(
        'MAIL_PORT',
      ) ?? '465',
    );

    const secureValue =
      this.configService
        .get<string>('MAIL_SECURE')
        ?.trim()
        .toLowerCase();

    const secure =
      secureValue !== 'false';

    const user =
      this.configService
        .get<string>('MAIL_USER')
        ?.trim() ?? '';

    const password =
      this.configService
        .get<string>('MAIL_PASSWORD')
        ?.replace(/\s+/g, '')
        .trim() ?? '';

    this.fromName =
      this.configService
        .get<string>('MAIL_FROM_NAME')
        ?.trim() || 'MedCNX';

    this.fromEmail =
      this.configService
        .get<string>('MAIL_FROM_EMAIL')
        ?.trim() ||
      user;

    this.configured = Boolean(
      host &&
        port &&
        user &&
        password &&
        this.fromEmail,
    );

    if (!this.configured) {
      this.transporter = null;

      this.logger.warn(
        [
          'Email configuration is incomplete.',
          'MedCNX will still start, but emails cannot be sent.',
          `MAIL_HOST configured: ${Boolean(host)}`,
          `MAIL_PORT configured: ${Boolean(port)}`,
          `MAIL_USER configured: ${Boolean(user)}`,
          `MAIL_PASSWORD configured: ${Boolean(password)}`,
          `MAIL_FROM_EMAIL configured: ${Boolean(
            this.fromEmail,
          )}`,
        ].join(' '),
      );

      return;
    }

    this.transporter =
      nodemailer.createTransport({
        host,
        port,
        secure,

        auth: {
          user,
          pass: password,
        },

        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,

        tls: {
          rejectUnauthorized: true,
        },
      });

    this.logger.log(
      [
        'Email transport configured.',
        `Host: ${host}`,
        `Port: ${port}`,
        `Secure: ${secure}`,
        `User: ${this.maskEmail(user)}`,
        `From: ${this.maskEmail(
          this.fromEmail,
        )}`,
      ].join(' '),
    );

    void this.verifyTransport();
  }

  async sendMail(input: SendMailInput) {
    if (
      !this.configured ||
      !this.transporter
    ) {
      this.logger.error(
        `Email could not be sent to ${input.to} because mail configuration is incomplete.`,
      );

      throw new InternalServerErrorException(
        'Email notifications are not configured.',
      );
    }

    const options: SendMailOptions = {
      from: {
        name: this.fromName,
        address: this.fromEmail,
      },

      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      cc: input.cc,
      bcc: input.bcc,
      replyTo: input.replyTo,
    };

    try {
      const result =
        await this.transporter.sendMail(
          options,
        );

      this.logger.log(
        [
          `Email sent successfully.`,
          `To: ${this.maskEmail(
            input.to,
          )}`,
          `Message ID: ${result.messageId}`,
          `Accepted: ${JSON.stringify(
            result.accepted,
          )}`,
          `Rejected: ${JSON.stringify(
            result.rejected,
          )}`,
          `Response: ${
            result.response ??
            'No response'
          }`,
        ].join(' '),
      );

      return {
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected,
        response: result.response,
      };
    } catch (error: unknown) {
      const mailError =
        error as MailError;

      this.logger.error(
        [
          `Could not send email to ${this.maskEmail(
            input.to,
          )}.`,
          `Message: ${
            mailError.message ??
            'Unknown error'
          }`,
          `Code: ${
            mailError.code ??
            'Unknown'
          }`,
          `Response code: ${
            mailError.responseCode ??
            'Unknown'
          }`,
          `Command: ${
            mailError.command ??
            'Unknown'
          }`,
          `Response: ${
            mailError.response ??
            'Unknown'
          }`,
        ].join('\n'),
        mailError.stack,
      );

      throw new InternalServerErrorException(
        'The notification email could not be sent.',
      );
    }
  }

  private async verifyTransport() {
    if (
      !this.configured ||
      !this.transporter
    ) {
      return;
    }

    try {
      await this.transporter.verify();

      this.logger.log(
        'SMTP connection verified successfully.',
      );
    } catch (error: unknown) {
      const mailError =
        error as MailError;

      this.logger.error(
        [
          'SMTP verification failed.',
          `Message: ${
            mailError.message ??
            'Unknown error'
          }`,
          `Code: ${
            mailError.code ??
            'Unknown'
          }`,
          `Response code: ${
            mailError.responseCode ??
            'Unknown'
          }`,
          `Command: ${
            mailError.command ??
            'Unknown'
          }`,
          `Response: ${
            mailError.response ??
            'Unknown'
          }`,
        ].join('\n'),
        mailError.stack,
      );
    }
  }

  private maskEmail(
    email: string,
  ) {
    const [localPart, domain] =
      email.split('@');

    if (!localPart || !domain) {
      return '***';
    }

    const visible =
      localPart.slice(0, 2);

    const hidden =
      '*'.repeat(
        Math.max(
          3,
          localPart.length - 2,
        ),
      );

    return `${visible}${hidden}@${domain}`;
  }
}
