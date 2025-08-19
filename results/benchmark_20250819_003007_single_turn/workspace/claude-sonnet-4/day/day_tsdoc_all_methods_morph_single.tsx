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
 * Props interface for the Day component.
 * Defines all the properties that can be passed to configure day rendering and behavior.
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
  /** Aria label prefix when the day is enabled for accessibility */
  ariaLabelPrefixWhenEnabled?: string;
  /** Aria label prefix when the day is disabled for accessibility */
  ariaLabelPrefixWhenDisabled?: string;
  /** Whether keyboard navigation is disabled for this day */
  disabledKeyboardNavigation?: boolean;
  /** The date object representing this day */
  day: Date;
  /** Optional function to provide custom CSS classes for the day based on the date */
  dayClassName?: (date: Date) => string;
  /** Map of highlighted dates with their corresponding CSS classes */
  highlightDates?: Map<string, string[]>;
  /** Map of holidays with their associated styling and names */
  holidays?: HolidaysMap;
  /** Whether the datepicker is displayed inline */
  inline?: boolean;
  /** Whether this day should receive focus when in inline mode */
  shouldFocusDayInline?: boolean;
  /** The month number (0-11) that this day belongs to */
  month: number;
  /** Click event handler for the day */
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  /** Mouse enter event handler for the day */
  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
  /** Keyboard event handler for the day */
  handleOnKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  /** Whether to use pointer events instead of mouse events */
  usePointerEvent?: boolean;
  /** The currently pre-selected date (for keyboard navigation) */
  preSelection?: Date | null;
  /** The currently selected date */
  selected?: Date | null;
  /** The date currently being selected (during range selection) */
  selectingDate?: Date;
  /** Whether this day can be selected as the end of a date range */
  selectsEnd?: boolean;
  /** Whether this day can be selected as the start of a date range */
  selectsStart?: boolean;
  /** Whether this day supports range selection */
  selectsRange?: boolean;
  /** Whether week picker mode is enabled */
  showWeekPicker?: boolean;
  /** Whether week numbers should be displayed */
  showWeekNumber?: boolean;
  /** Whether disabled days can be included in range selection */
  selectsDisabledDaysInRange?: boolean;
  /** Whether multiple date selection is enabled */
  selectsMultiple?: boolean;
  /** Array of currently selected dates (for multiple selection) */
  selectedDates?: Date[];
  /** The start date of a selected range */
  startDate?: Date | null;
  /** The end date of a selected range */
  endDate?: Date | null;
  /** Optional function to customize the rendering of day contents */
  renderDayContents?: (day: number, date: Date) => React.ReactNode;
  /** Reference to the calendar container element */
  containerRef?: React.RefObject<HTMLDivElement | null>;
  /** The first day of the week (0-6, where 0 is Sunday) */
  calendarStartDay?: DateNumberType;
  /** Locale configuration for date formatting */
  locale?: Locale;
  /** Whether duplicate days should be shown at the end of the month */
  monthShowsDuplicateDaysEnd?: boolean;
  /** Whether duplicate days should be shown at the start of the month */
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
  componentDidMount() {
    this.handleFocusDay();
  }

  componentDidUpdate() {
    this.handleFocusDay();
  }

  dayEl = createRef<HTMLDivElement>();

  /**
   * Handles click events on the day element.
   * Only processes clicks if the day is not disabled.
   * 
   * @param event - The mouse event object
   */
  handleClick: DayProps["onClick"] = (event) => {
    if (!this.isDisabled() && this.props.onClick) {
      this.props.onClick(event);
    }
  };

  /**
   * Handles mouse enter events on the day element.
   * Only processes mouse enter if the day is not disabled.
   * 
   * @param event - The mouse event object
   */
  handleMouseEnter: DayProps["onMouseEnter"] = (event) => {
    if (!this.isDisabled() && this.props.onMouseEnter) {
      this.props.onMouseEnter(event);
    }
  };

  /**
   * Handles keyboard events on the day element.
   * Converts Space key to Enter key for accessibility.
   * 
   * @param event - The keyboard event object
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
   * Checks if this day is the same as another date.
   * 
   * @param other - The date to compare against
   * @returns True if the days are the same, false otherwise
   */
  isSameDay = (other: Date | null | undefined) =>
    isSameDay(this.props.day, other);

  /**
   * Determines if this day should be highlighted as keyboard selected.
   * Takes into account disabled keyboard navigation and current selection state.
   * 
   * @returns True if the day should show keyboard selection styling
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
   * Determines if a day is disabled based on date filtering options.
   * 
   * @param day - The day to check (defaults to this component's day)
   * @returns True if the day is disabled, false otherwise
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
   * Determines if this day is excluded from selection.
   * 
   * @returns True if the day is excluded, false otherwise
   */
  isExcluded = () =>
    // Almost all props previously were passed as this.props w/o proper typing with prop-types
    // after the migration to TS i made it explicit
    isDayExcluded(this.props.day, {
      excludeDates: this.props.excludeDates,
      excludeDateIntervals: this.props.excludeDateIntervals,
    });

  /**
   * Checks if this day is the start of a week.
   * 
   * @returns True if this day is the first day of the week
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
   * Checks if this day is in the same week as another date.
   * Only relevant when week picker is enabled.
   * 
   * @param other - The date to compare against
   * @returns True if both dates are in the same week
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
   * Checks if this day is the same day OR in the same week as another date.
   * 
   * @param other - The date to compare against
   * @returns True if days match or weeks match (when week picker enabled)
   */
  isSameDayOrWeek = (other?: Date | null) =>
    this.isSameDay(other) || this.isSameWeek(other);

  /**
   * Gets the CSS class names for highlighted dates.
   * 
   * @returns CSS class names for highlighting, or false if not highlighted
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
   * Gets the CSS class names for holiday styling.
   * 
   * @returns Array containing holiday CSS class name or undefined
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
   * Checks if this day falls within a selected date range.
   * 
   * @returns True if the day is within the start and end date range
   */
  isInRange = () => {
    const { day, startDate, endDate } = this.props;
    if (!startDate || !endDate) {
      return false;
    }
    return isDayInRange(day, startDate, endDate);
  };

  /**
   * Checks if this day is within the currently selecting range.
   * Used during range selection to show preview of the range being selected.
   * 
   * @returns True if the day is in the selecting range
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
   * Checks if this day is the start of the currently selecting range.
   * 
   * @returns True if this day is the start of the selecting range
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
   * Checks if this day is the end of the currently selecting range.
   * 
   * @returns True if this day is the end of the selecting range
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
   * Checks if this day is the start of a selected date range.
   * 
   * @returns True if this day matches the range start date
   */
  isRangeStart = () => {
    const { day, startDate, endDate } = this.props;
    if (!startDate || !endDate) {
      return false;
    }
    return isSameDay(startDate, day);
  };

  /**
   * Checks if this day is the end of a selected date range.
   * 
   * @returns True if this day matches the range end date
   */
  isRangeEnd = () => {
    const { day, startDate, endDate } = this.props;
    if (!startDate || !endDate) {
      return false;
    }
    return isSameDay(endDate, day);
  };

  /**
   * Checks if this day falls on a weekend.
   * 
   * @returns True if the day is Saturday or Sunday
   */
  isWeekend = () => {
    const weekday = getDay(this.props.day);
    return weekday === 0 || weekday === 6;
  };

  /**
   * Checks if this day belongs to the month after the current display month.
   * 
   * @returns True if the day is from the next month
   */
  isAfterMonth = () => {
    return (
      this.props.month !== undefined &&
      (this.props.month + 1) % 12 === getMonth(this.props.day)
    );
  };

  /**
   * Checks if this day belongs to the month before the current display month.
   * 
   * @returns True if the day is from the previous month
   */
  isBeforeMonth = () => {
    return (
      this.props.month !== undefined &&
      (getMonth(this.props.day) + 1) % 12 === this.props.month
    );
  };

  /**
   * Checks if this day is today's date.
   * 
   * @returns True if this day represents the current date
   */
  isCurrentDay = () => this.isSameDay(newDate());

  /**
   * Checks if this day is currently selected.
   * Handles both single and multiple selection modes.
   * 
   * @returns True if the day is selected
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
   * Generates the complete CSS class names for the day element.
   * Combines base classes with conditional state classes.
   * 
   * @param date - The date object for this day
   * @returns Complete CSS class string for the day element
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
   * Generates the aria-label for accessibility.
   * Uses different prefixes based on whether the day is disabled/excluded.
   * 
   * @returns Formatted aria-label string for screen readers
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
   * Generates the title attribute content for tooltips.
   * Includes holiday names and exclusion messages.
   * 
   * @returns Title string containing holiday names or exclusion reasons
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
   * Determines the appropriate tabIndex for keyboard navigation.
   * Returns 0 for focusable elements, -1 for non-focusable elements.
   * 
   * @returns Tab index value (0 or -1)
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
   * Handles focusing the day element when appropriate.
   * Used for keyboard navigation and accessibility.
   */
  handleFocusDay = () => {
    // only do this while the input isn't focused
    // otherwise, typing/backspacing the date manually may steal focus away from the input
    this.shouldFocusDay() && this.dayEl.current?.focus({ preventScroll: true });
  };

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
   * Renders the content inside the day element.
   * Returns null for duplicate days that shouldn't be displayed.
   * 
   * @returns The day number or custom rendered content, or null for hidden duplicate days
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
   * Renders the complete Day component.
   * 
   * @returns JSX element representing the day with all event handlers and accessibility attributes
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