import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'isoDateToDmy',
  standalone: true
})
export class IsoDateToDmyPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '-';

    // Esperamos YYYY-MM-DD, pero nos blindamos ante valores inesperados.
    const iso = value.length >= 10 ? value.slice(0, 10) : value;
    const [yStr, mStr, dStr] = iso.split('-');
    const y = Number(yStr);
    const m = Number(mStr);
    const d = Number(dStr);

    if (!y || !m || !d) return value;

    const date = new Date(y, m - 1, d);
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  }
}

