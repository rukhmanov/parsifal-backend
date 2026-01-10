import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report, ReportStatus } from './report.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { User } from '../user/user.entity';

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(Report)
    private reportRepository: Repository<Report>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async create(reporterId: string, createReportDto: CreateReportDto): Promise<Report> {
    const { reportedUserId, type, description } = createReportDto;

    // Нельзя пожаловаться на самого себя
    if (reporterId === reportedUserId) {
      throw new BadRequestException('Нельзя пожаловаться на самого себя');
    }

    // Проверяем, существует ли пользователь, на которого жалуются
    const reportedUser = await this.userRepository.findOne({ where: { id: reportedUserId } });
    if (!reportedUser) {
      throw new NotFoundException('Пользователь не найден');
    }

    // Проверяем, не была ли уже подана жалоба от этого пользователя на этого пользователя
    const existingReport = await this.reportRepository.findOne({
      where: {
        reporterId,
        reportedUserId,
        status: 'pending',
      },
    });

    if (existingReport) {
      throw new BadRequestException('Вы уже подали жалобу на этого пользователя');
    }

    const report = this.reportRepository.create({
      reporterId,
      reportedUserId,
      type,
      description,
      status: 'pending',
    });

    return this.reportRepository.save(report);
  }

  async findAll(
    status?: ReportStatus,
    email?: string,
    page: number = 1,
    pageSize: number = 15
  ): Promise<{ data: Report[]; total: number; page: number; pageSize: number; totalPages: number }> {
    const queryBuilder = this.reportRepository
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.reporter', 'reporter')
      .leftJoinAndSelect('report.reportedUser', 'reportedUser')
      .orderBy('report.createdAt', 'DESC');

    // Если передан email, находим пользователя по email
    let reportedUserId: string | undefined;
    if (email && email.trim()) {
      const user = await this.userRepository.findOne({
        where: { email: email.trim() }
      });
      if (user) {
        reportedUserId = user.id;
      } else {
        // Если пользователь не найден, возвращаем пустой результат
        return {
          data: [],
          total: 0,
          page,
          pageSize,
          totalPages: 0,
        };
      }
    }

    if (status) {
      queryBuilder.where('report.status = :status', { status });
    }

    if (reportedUserId) {
      if (status) {
        queryBuilder.andWhere('report.reportedUserId = :reportedUserId', { reportedUserId });
      } else {
        queryBuilder.where('report.reportedUserId = :reportedUserId', { reportedUserId });
      }
    }

    // Подсчитываем общее количество
    const total = await queryBuilder.getCount();

    // Применяем пагинацию
    const skip = (page - 1) * pageSize;
    queryBuilder.skip(skip).take(pageSize);

    const data = await queryBuilder.getMany();

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findById(id: string): Promise<Report> {
    const report = await this.reportRepository.findOne({
      where: { id },
      relations: ['reporter', 'reportedUser'],
    });

    if (!report) {
      throw new NotFoundException('Жалоба не найдена');
    }

    return report;
  }

  async update(id: string, userId: string, updateReportDto: UpdateReportDto): Promise<Report> {
    const report = await this.findById(id);

    // Проверяем права (только администраторы могут обновлять жалобы)
    // Это будет проверяться через PermissionsGuard на уровне контроллера

    if (updateReportDto.status) {
      report.status = updateReportDto.status;
      report.reviewedBy = userId;
      report.reviewedAt = new Date();
    }

    if (updateReportDto.adminNotes !== undefined) {
      report.adminNotes = updateReportDto.adminNotes;
    }

    return this.reportRepository.save(report);
  }

  async delete(id: string): Promise<void> {
    const report = await this.findById(id);
    await this.reportRepository.remove(report);
  }

  async getReportsByUser(userId: string): Promise<Report[]> {
    return this.reportRepository.find({
      where: { reportedUserId: userId },
      relations: ['reporter'],
      order: { createdAt: 'DESC' },
    });
  }

  async getReportsByReporter(reporterId: string): Promise<Report[]> {
    return this.reportRepository.find({
      where: { reporterId },
      relations: ['reportedUser'],
      order: { createdAt: 'DESC' },
    });
  }
}

