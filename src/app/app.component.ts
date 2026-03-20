import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DataMigrationService } from './core/services/data-migration.service';
import { RateConfigService } from './core/services/rate-config.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  constructor(
    private readonly rateConfigService: RateConfigService,
    private readonly dataMigrationService: DataMigrationService
  ) {
    this.dataMigrationService.runMigrations();
    this.rateConfigService.ensureSeedData();
  }
}
