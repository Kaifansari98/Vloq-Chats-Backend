import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { CreateOrgDto, createOrgSchema } from './dto/create-org.schema';

@Controller('organization')
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  @Post()
  async createOrg(@Body() body: unknown) {
    const result = createOrgSchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }

    const data: CreateOrgDto = result.data;
    return this.orgService.createOrganization(data);
  }
}
