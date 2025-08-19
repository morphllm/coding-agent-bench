import { clsx } from "clsx";
import React, { Component, createRef } from "react";

import {
  getDay,
  getMonth,
  getDate,
  newDate,
  isSameDay,
  isDayDisabled,
  isDayExcluded,
  isDayInRange,
  isEqual,
  isBefore,
  isAfter,
  getDayOfWeekCode,
  getStartOfWeek,
  formatDate,
  type DateFilterOptions,
  type DateNumberType,
  type Locale,
  type HolidaysMap,
  KeyType,
} from "./date_utils";

/**
 * Props accepted by the `Day` component.
 *
 * This interface is intentionally exhaustive so that any consumer of the
 * `Day` component has compile-time visibility into what can be passed.
 * Most of the properties are forwarded directly to helper utilities that
 * determine disabled/excluded states, keyboard interaction, range
 * calculations, etc.
 *
 * NOTE:  The majority of the properties below are optional because the
 * `Day` component is used in many different picker configurations
 * (single date, range, multiple select, week picker, etc.).
 */
interface DayProps
  extends Pick<
    DateFilterOptions,
    | "minDate"
    | "maxDate"
    | "excludeDates"
    | "excludeDateIntervals"
    | "includeDateIntervals"
    | "includeDates"
    | "filterDate"
  > {
  /** Text that will prefix the `aria-label` when the day is enabled. */
  ariaLabelPrefixWhenEnabled?: string;
  /** Text that will prefix the `aria-label` when the day is disabled. */
  ariaLabelPrefixWhenDisabled?: string;
  /** When true, arrow-key navigation is ignored by this day element. */
  disabledKeyboardNavigation?: boolean;
  /** The `Date` instance this component represents. */
  day: Date;
  /** Callback to compute a custom className for the day element. */
  dayClassName?: (date: Date) => string;
  /** A map of dates (`MM.dd.yyyy`) to classNames used for highlighting. */
  highlightDates?: Map<string, string[]>;
  /** Map of holidays whose names and classNames should be surfaced. */
  holidays?: HolidaysMap;
  /** Whether the picker is rendered inline (i.e. not in a popper). */
  inline?: boolean;
  /** Forces focus on the day element when used inline. */
  shouldFocusDayInline?: boolean;
  /** The month (0-based) that is currently being rendered by the calendar. */
  month: number;
  /** Click handler for the day element. */
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  /** Mouse-enter handler for the day element. */
  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
  /** Key-down handler for the day element. */
  handleOnKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  /** Whether pointer events are preferred over mouse events. */
  usePointerEvent?: boolean;
  /** The date that is currently highlighted via keyboard navigation. */
  preSelection?: Date | null;
  /** The single selected date (when not using multi/range). */
  selected?: Date | null;
  /** The date that is being selected while the mouse button is held. */
  selectingDate?: Date;
  /** True when this picker chooses an end date of a range. */
  selectsEnd?: boolean;
  /** True when this picker chooses a start date of a range. */
  selectsStart?: boolean;
  /** True when this picker chooses any date in a range. */
  selectsRange?: boolean;
  /** True when the component is used as a week picker. */
  showWeekPicker?: boolean;
  /** True to render week numbers in the calendar UI. */
  showWeekNumber?: boolean;
  /** Allow disabled days to be part of a selecting range. */
  selectsDisabledDaysInRange?: boolean;
  /** Enables multi-select mode. */
  selectsMultiple?: boolean;
  /** The array of selected dates when in multi-select mode. */
  selectedDates?: Date[];
  /** Range start date (when using range functionality). */
  startDate?: Date | null;
  /** Range end date (when using range functionality). */
  endDate?: Date | null;
  /** Custom renderer for the day content. */
  renderDayContents?: (day: number, date: Date) => React.ReactNode;
  /** Ref to the container that holds all day elements. */
  containerRef?: React.RefObject<HTMLDivElement | null>;
  /** Custom start day of the week, 0 (Sunday) – 6 (Saturday). */
  calendarStartDay?: DateNumberType;
  /** Locale information that affects formatting and week starts. */
  locale?: Locale;
  /** Indicates the current month shows duplicate trailing days. */
  monthShowsDuplicateDaysEnd?: boolean;
  /** Indicates the current month shows duplicate leading days. */
  monthShowsDuplicateDaysStart?: boolean;
}

/**
 * `Day` is a React component that represents a single day in a date picker.
 * It handles the rendering and interaction of a day.
 *
 * @prop ariaLabelPrefixWhenEnabled - Aria label prefix when the day is enabled.
 * @prop ariaLabelPrefixWhenDisabled - Aria label prefix when the day is disabled.
 * @prop disabledKeyboardNavigation - Whether keyboard navigation is disabled.
 * @prop day - The day to be displayed.
 * @prop dayClassName - Function to customize the CSS class of the day.
 * @prop endDate - The end date in a range.
 * @prop highlightDates - Map of dates to be highlighted.
 * @prop holidays - Map of holiday dates.
 * @prop inline - Whether the date picker is inline.
 * @prop shouldFocusDayInline - Whether the day should be focused when date picker is inline.
 * @prop month - The month the day belongs to.
 * @prop onClick - Click event handler.
 * @prop onMouseEnter - Mouse enter event handler.
 * @prop handleOnKeyDown - Key down event handler.
 * @prop usePointerEvent - Whether to use pointer events.
 * @prop preSelection - The date that is currently selected.
 * @prop selected - The selected date.
 * @prop selectingDate - The date currently being selected.
 * @prop selectsEnd - Whether the day can be the end date in a range.
 * @prop selectsStart - Whether the day can be the start date in a range.
 * @prop selectsRange - Whether the day can be in a range.
 * @prop showWeekPicker - Whether to show week picker.
 * @prop showWeekNumber - Whether to show week numbers.
 * @prop selectsDisabledDaysInRange - Whether to select disabled days in a range.
 * @prop selectsMultiple - Whether to allow multiple date selection.
 * @prop selectedDates - Array of selected dates.
 * @prop startDate - The start date in a range.
 * @prop renderDayContents - Function to customize the rendering of the day's contents.
 * @prop containerRef - Ref for the container.
 * @prop excludeDates - Array of dates to be excluded.
 * @prop calendarStartDay - The start day of the week.
 * @prop locale - The locale object.
 * @prop monthShowsDuplicateDaysEnd - Whether to show duplicate days at the end of the month.
 * @prop monthShowsDuplicateDaysStart - Whether to show duplicate days at the start of the month.
 * @prop includeDates - Array of dates to be included.
 * @prop includeDateIntervals - Array of date intervals to be included.
 * @prop minDate - The minimum date that can be selected.
 * @prop maxDate - The maximum date that can be selected.
 *
 * @example
 * ```tsx
 * import React from 'react';
 * import Day from './day';
 *
 * function MyComponent() {
 *   const handleDayClick = (event) => {
 *     console.log('Day clicked', event);
 *   };
 *
 *   const handleDayMouseEnter = (event) => {
 *     console.log('Mouse entered day', event);
 *   };
 *
 *   const renderDayContents = (date) => {
 *     return <div>{date.getDate()}</div>;
 *   };
 *
 *   return (
 *     <Day
 *       day={new Date()}
 *       onClick={handleDayClick}
 *       onMouseEnter={handleDayMouseEnter}
 *       renderDayContents={renderDayContents}
 *     />
 *   );
 * }
 *
 * export default MyComponent;
 * ```
 */
export default class Day extends Component<DayProps> {
  /**
   * Lifecycle: After mount, apply focus logic if necessary.
   */
  componentDidMount() {
    this.handleFocusDay();
  }

  /**
   * Lifecycle: After update, re-evaluate focus logic in case the pre-selection
   * or rendered month has changed.
   */
  componentDidUpdate() {
    this.handleFocusDay();
  }

  /** Ref to the root `div` so we can imperatively focus it. */
  dayEl = createRef<HTMLDivElement>();

  /**
   * Handle a mouse click on the day element.
   *
   * Prevents the click when the day is disabled and delegates to the consumer
   * via `props.onClick`.
   */
  handleClick: DayProps["onClick"] = (event) => {
    if (!this.isDisabled() && this.props.onClick) {
      this.props.onClick(event);
    }
  };

  /**
   * Handle a mouse (or pointer) enter event.
   *
   * Delegates to `props.onMouseEnter` after guarding against disabled days.
   */
  handleMouseEnter: DayProps["onMouseEnter"] = (event) => {
    if (!this.isDisabled() && this.props.onMouseEnter) {
      this.props.onMouseEnter(event);
    }
  };

  /**
   * Normalize keyboard interaction by mapping <Space> to <Enter> so that
   * accessibility expectations are met across devices.
   */
  handleOnKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    const eventKey = event.key;
    if (eventKey === KeyType.Space) {
      event.preventDefault();
      event.key = KeyType.Enter;
    }

    this.props.handleOnKeyDown?.(event);
  };

  /**
   * Determines if the provided date is the same calendar day as the current
   * component's `day` prop.
   */
  isSameDay = (other: Date | null | undefined) =>
    isSameDay(this.props.day, other);

  /**
   * Whether this day should appear as "keyboard selected".  This is the day
   * that receives focus so arrow-key navigation can start from it.
   */
  isKeyboardSelected = () => {
    if (this.props.disabledKeyboardNavigation) {
      return false;
    }

    const isSelectedDate = this.props.selectsMultiple
      ? this.props.selectedDates?.some((date) => this.isSameDayOrWeek(date))
      : this.isSameDayOrWeek(this.props.selected);

    const isDisabled =
      this.props.preSelection && this.isDisabled(this.props.preSelection);

    return (
      !isSelectedDate &&
      this.isSameDayOrWeek(this.props.preSelection) &&
      !isDisabled
    );
  };

  /**
   * Determine if the current day (or provided day) is disabled according to
   * min/max, include/exclude sets, and arbitrary filter function.
   *
   * @param day - optional override instead of using `this.props.day`
   * @returns `true` when the day should be non-interactive.
   */
  isDisabled = (day = this.props.day) =>
    // Almost all props previously were passed as this.props w/o proper typing with prop-types
    // after the migration to TS i made it explicit
    isDayDisabled(day, {
      minDate: this.props.minDate,
      maxDate: this.props.maxDate,
      excludeDates: this.props.excludeDates,
      excludeDateIntervals: this.props.excludeDateIntervals,
      includeDateIntervals: this.props.includeDateIntervals,
      includeDates: this.props.includeDates,
      filterDate: this.props.filterDate,
    });

  /**
   * Whether the day is explicitly excluded via `excludeDates` or
   * `excludeDateIntervals`.
   */
  isExcluded = () =>
    // Almost all props previously were passed as this.props w/o proper typing with prop-types
    // after the migration to TS i made it explicit
    isDayExcluded(this.props.day, {
      excludeDates: this.props.excludeDates,
      excludeDateIntervals: this.props.excludeDateIntervals,
    });

  /**
   * True when the day is the first day of the week according to locale/start-day
   * settings.  Used primarily when rendering week numbers.
   */
  isStartOfWeek = () =>
    isSameDay(
      this.props.day,
      getStartOfWeek(
        this.props.day,
        this.props.locale,
        this.props.calendarStartDay,
      ),
    );

  /**
   * Determines if the given date is in the same week as this component's day.
   * Takes the `showWeekPicker` prop into account.
   */
  isSameWeek = (other?: Date | null) =>
    this.props.showWeekPicker &&
    isSameDay(
      other,
      getStartOfWeek(
        this.props.day,
        this.props.locale,
        this.props.calendarStartDay,
      ),
    );

  /**
   * Convenience helper that checks either same day or same week depending on
   * whether week-picker mode is enabled.
   */
  isSameDayOrWeek = (other?: Date | null) =>
    this.isSameDay(other) || this.isSameWeek(other);

  /**
   * Returns the className(s) to apply when this date is found in the
   * `highlightDates` map prop.
   */
  getHighLightedClass = () => {
    const { day, highlightDates } = this.props;

    if (!highlightDates) {
      return false;
    }

    // Looking for className in the Map of {'day string, 'className'}
    const dayStr = formatDate(day, "MM.dd.yyyy");
    return highlightDates.get(dayStr);
  };

  /**
   * Returns an array with a single className when the date matches a holiday
   * entry in the `holidays` prop.
   */
  getHolidaysClass = () => {
    const { day, holidays } = this.props;
    if (!holidays) {
      // For type consistency no other reasons
      return [undefined];
    }
    const dayStr = formatDate(day, "MM.dd.yyyy");
    // Looking for className in the Map of {day string: {className, holidayName}}
    if (holidays.has(dayStr)) {
      return [holidays.get(dayStr)?.className];
    }

    // For type consistency no other reasons
    return [undefined];
  };

  /**
   * Whether the `day` sits within the `startDate`/`endDate` inclusive range.
   */
  isInRange = () => {
    const { day, startDate, endDate } = this.props;
    if (!startDate || !endDate) {
      return false;
    }
    return isDayInRange(day, startDate, endDate);
  };

  /**
   * Calculates whether the `day` is inside the range that is currently being
   * selected (mouse hovering or keyboard navigating) but not yet finalized.
   */
  isInSelectingRange = () => {
    const {
      day,
      selectsStart,
      selectsEnd,
      selectsRange,
      selectsDisabledDaysInRange,
      startDate,
      endDate,
    } = this.props;

    const selectingDate = this.props.selectingDate ?? this.props.preSelection;

    if (
      !(selectsStart || selectsEnd || selectsRange) ||
      !selectingDate ||
      (!selectsDisabledDaysInRange && this.isDisabled())
    ) {
      return false;
    }

    if (
      selectsStart &&
      endDate &&
      (isBefore(selectingDate, endDate) || isEqual(selectingDate, endDate))
    ) {
      return isDayInRange(day, selectingDate, endDate);
    }

    if (
      selectsEnd &&
      startDate &&
      (isAfter(selectingDate, startDate) || isEqual(selectingDate, startDate))
    ) {
      return isDayInRange(day, startDate, selectingDate);
    }

    if (
      selectsRange &&
      startDate &&
      !endDate &&
      (isAfter(selectingDate, startDate) || isEqual(selectingDate, startDate))
    ) {
      return isDayInRange(day, startDate, selectingDate);
    }

    return false;
  };

  /**
   * `true` when the day is the first date in the currently selecting range.
   */
  isSelectingRangeStart = () => {
    if (!this.isInSelectingRange()) {
      return false;
    }

    const { day, startDate, selectsStart } = this.props;
    const selectingDate = this.props.selectingDate ?? this.props.preSelection;

    if (selectsStart) {
      return isSameDay(day, selectingDate);
    } else {
      return isSameDay(day, startDate);
    }
  };

  /**
   * `true` when the day is the last date in the currently selecting range.
   */
  isSelectingRangeEnd = () => {
    if (!this.isInSelectingRange()) {
      return false;
    }

    const { day, endDate, selectsEnd, selectsRange } = this.props;
    const selectingDate = this.props.selectingDate ?? this.props.preSelection;

    if (selectsEnd || selectsRange) {
      return isSameDay(day, selectingDate);
    } else {
      return isSameDay(day, endDate);
    }
  };

  /**
   * Returns `true` if this date is the very first date of the selected range.
   */
  isRangeStart = () => {
    const { day, startDate, endDate } = this.props;
    if (!startDate || !endDate) {
      return false;
    }
    return isSameDay(startDate, day);
  };

  /**
   * Returns `true` if this date is the very last date of the selected range.
   */
  isRangeEnd = () => {
    const { day, startDate, endDate } = this.props;
    if (!startDate || !endDate) {
      return false;
    }
    return isSameDay(endDate, day);
  };

  /**
   * Whether the day falls on a weekend (Saturday/Sunday).
   */
  isWeekend = () => {
    const weekday = getDay(this.props.day);
    return weekday === 0 || weekday === 6;
  };

  /**
   * `true` when the day belongs to the month immediately after the
   * `props.month` (used for overflow days rendered at the end of a month view).
   */
  isAfterMonth = () => {
    return (
      this.props.month !== undefined &&
      (this.props.month + 1) % 12 === getMonth(this.props.day)
    );
  };

  /**
   * `true` when the day belongs to the month immediately before the
   * `props.month` (used for overflow days rendered at the start of a month view).
   */
  isBeforeMonth = () => {
    return (
      this.props.month !== undefined &&
      (getMonth(this.props.day) + 1) % 12 === this.props.month
    );
  };

  /**
   * Whether the day represents "today" according to the system clock.
   */
  isCurrentDay = () => this.isSameDay(newDate());

  /**
   * Whether the day is part of the currently selected set of dates.
   * Supports single-select, multi-select, and week-picker modes.
   */
  isSelected = () => {
    if (this.props.selectsMultiple) {
      return this.props.selectedDates?.some((date) =>
        this.isSameDayOrWeek(date),
      );
    }
    return this.isSameDayOrWeek(this.props.selected);
  };

  /**
   * Compute the full className string based on all of the modifier checks.
   */
  getClassNames = (date: Date) => {
    const dayClassName = this.props.dayClassName
      ? this.props.dayClassName(date)
      : undefined;
    return clsx(
      "react-datepicker__day",
      dayClassName,
      "react-datepicker__day--" + getDayOfWeekCode(this.props.day),
      {
        "react-datepicker__day--disabled": this.isDisabled(),
        "react-datepicker__day--excluded": this.isExcluded(),
        "react-datepicker__day--selected": this.isSelected(),
        "react-datepicker__day--keyboard-selected": this.isKeyboardSelected(),
        "react-datepicker__day--range-start": this.isRangeStart(),
        "react-datepicker__day--range-end": this.isRangeEnd(),
        "react-datepicker__day--in-range": this.isInRange(),
        "react-datepicker__day--in-selecting-range": this.isInSelectingRange(),
        "react-datepicker__day--selecting-range-start":
          this.isSelectingRangeStart(),
        "react-datepicker__day--selecting-range-end":
          this.isSelectingRangeEnd(),
        "react-datepicker__day--today": this.isCurrentDay(),
        "react-datepicker__day--weekend": this.isWeekend(),
        "react-datepicker__day--outside-month":
          this.isAfterMonth() || this.isBeforeMonth(),
      },
      this.getHighLightedClass(),
      this.getHolidaysClass(),
    );
  };

  /**
   * Compose an accessible `aria-label` describing the date and its availability.
   */
  getAriaLabel = () => {
    const {
      day,
      ariaLabelPrefixWhenEnabled = "Choose",
      ariaLabelPrefixWhenDisabled = "Not available",
    } = this.props;

    const prefix =
      this.isDisabled() || this.isExcluded()
        ? ariaLabelPrefixWhenDisabled
        : ariaLabelPrefixWhenEnabled;

    return `${prefix} ${formatDate(day, "PPPP", this.props.locale)}`;
  };

  /**
   * Returns a comma-separated string suitable for the `title` attribute that
   * lists the holiday names and/or exclusion reasons for the day.
   */
  getTitle = () => {
    const { day, holidays = new Map(), excludeDates } = this.props;
    const compareDt = formatDate(day, "MM.dd.yyyy");
    const titles = [];
    if (holidays.has(compareDt)) {
      titles.push(...holidays.get(compareDt).holidayNames);
    }
    if (this.isExcluded()) {
      titles.push(
        excludeDates
          ?.filter((excludeDate) => {
            if (excludeDate instanceof Date) {
              return isSameDay(excludeDate, day);
            }
            return isSameDay(excludeDate?.date, day);
          })
          .map((excludeDate) => {
            if (excludeDate instanceof Date) {
              return undefined;
            }
            return excludeDate?.message;
          }),
      );
    }
    // I'm not sure that this is a right output, but all tests are green
    return titles.join(", ");
  };

  /**
   * The `tabIndex` is set to `0` for the element that should receive focus
   * within the calendar grid; all other days get `-1`.
   */
  getTabIndex = () => {
    const selectedDay = this.props.selected;
    const preSelectionDay = this.props.preSelection;
    const tabIndex =
      !(
        this.props.showWeekPicker &&
        (this.props.showWeekNumber || !this.isStartOfWeek())
      ) &&
      (this.isKeyboardSelected() ||
        (this.isSameDay(selectedDay) &&
          isSameDay(preSelectionDay, selectedDay)))
        ? 0
        : -1;

    return tabIndex;
  };

  /**
   * Evaluate whether the day should be focused and, if so, call `.focus()` on
   * the element referenced by `dayEl`.
   */
  handleFocusDay = () => {
    // only do this while the input isn't focused
    // otherwise, typing/backspacing the date manually may steal focus away from the input
    this.shouldFocusDay() && this.dayEl.current?.focus({ preventScroll: true });
  };

  // various cases when we need to apply focus to the preselected day
  // focus the day on mount/update so that keyboard navigation works while cycling through months with up or down keys (not for prev and next month buttons)
  // prevent focus for these activeElement cases so we don't pull focus from the input as the calendar opens
  private shouldFocusDay() {
    let shouldFocusDay = false;
    if (this.getTabIndex() === 0 && this.isSameDay(this.props.preSelection)) {
      // there is currently no activeElement and not inline
      if (!document.activeElement || document.activeElement === document.body) {
        shouldFocusDay = true;
      }
      // inline version:
      // do not focus on initial render to prevent autoFocus issue
      // focus after month has changed via keyboard
      if (this.props.inline && !this.props.shouldFocusDayInline) {
        shouldFocusDay = false;
      }
      if (this.isDayActiveElement()) {
        shouldFocusDay = true;
      }
      if (this.isDuplicateDay()) {
        shouldFocusDay = false;
      }
    }
    return shouldFocusDay;
  }

  // the activeElement is in the container, and it is another instance of Day
  private isDayActiveElement() {
    return (
      this.props.containerRef?.current?.contains(document.activeElement) &&
      document.activeElement?.classList.contains("react-datepicker__day")
    );
  }

  private isDuplicateDay() {
    return (
      //day is one of the non rendered duplicate days
      (this.props.monthShowsDuplicateDaysEnd && this.isAfterMonth()) ||
      (this.props.monthShowsDuplicateDaysStart && this.isBeforeMonth())
    );
  }

  /**
   * Delegates to `props.renderDayContents` (if provided) otherwise returns just
   * the numeric day of the month.  Duplicate filler days are rendered as
   * `null` to avoid duplicate DOM nodes.
   */
  renderDayContents = () => {
    if (this.props.monthShowsDuplicateDaysEnd && this.isAfterMonth())
      return null;
    if (this.props.monthShowsDuplicateDaysStart && this.isBeforeMonth())
      return null;
    return this.props.renderDayContents
      ? this.props.renderDayContents(getDate(this.props.day), this.props.day)
      : getDate(this.props.day);
  };

  /**
   * Render method for the React component.  Outputs a fully accessible `<div>`
   * behaving like an `<option>` inside the grid (listbox) representing the
   * calendar month.
   */
  render = () => (
    // TODO: Use <option> instead of the "option" role to ensure accessibility across all devices.
    <div
      ref={this.dayEl}
      className={this.getClassNames(this.props.day)}
      onKeyDown={this.handleOnKeyDown}
      onClick={this.handleClick}
      onMouseEnter={
        !this.props.usePointerEvent ? this.handleMouseEnter : undefined
      }
      onPointerEnter={
        this.props.usePointerEvent ? this.handleMouseEnter : undefined
      }
      tabIndex={this.getTabIndex()}
      aria-label={this.getAriaLabel()}
      role="option"
      title={this.getTitle()}
      aria-disabled={this.isDisabled()}
      aria-current={this.isCurrentDay() ? "date" : undefined}
      aria-selected={this.isSelected() || this.isInRange()}
    >
      {this.renderDayContents()}
      {this.getTitle() !== "" && (
        <span className="overlay">{this.getTitle()}</span>
      )}
    </div>
  );
}

