import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, loginSchema } from './dto/login.schema';

@Controller('app/auth')
export class AppAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: Record<string, unknown>) {
    const payload = {
      ...body,
      provider: body.provider || 'EMAIL',
      email: typeof body.email === 'string' ? body.email.toLowerCase().trim() : '',
    };

    const result = loginSchema.safeParse(payload);

    if (!result.success) {
      const flat = result.error.flatten();
      const firstError =
        Object.values(flat.fieldErrors)[0]?.[0] ||
        flat.formErrors[0] ||
        'Invalid login parameters';
      throw new BadRequestException(firstError);
    }

    const data: LoginDto = result.data;
    return this.authService.login(data);
  }
}

