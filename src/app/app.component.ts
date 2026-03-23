import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DataMigrationService } from './core/services/data-migration.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  constructor(private readonly dataMigrationService: DataMigrationService) {
    this.dataMigrationService.runMigrations();
  }
}
