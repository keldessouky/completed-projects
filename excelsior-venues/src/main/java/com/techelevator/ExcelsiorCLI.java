package com.techelevator;

import java.time.LocalDate;

import java.util.List;

import javax.sql.DataSource;

import org.apache.commons.dbcp2.BasicDataSource;

import com.techelevator.model.domain.Reservation;
import com.techelevator.model.domain.Space;
import com.techelevator.model.domain.Venue;
import com.techelevator.view.Menu;

public class ExcelsiorCLI {

	private Menu menu;
	private Controller controller;
	private static Venue venues;
	private static Space space;

	// private Reservation reservation;

	public static void main(String[] args) {
		Menu menu = new Menu(venues, space);
		BasicDataSource dataSource = new BasicDataSource();
		dataSource.setUrl("jdbc:postgresql://localhost:5432/excelsior-venues");
		dataSource.setUsername("postgres");
		dataSource.setPassword("postgres1");
		ExcelsiorCLI application = new ExcelsiorCLI(dataSource, menu);
		application.run();
	}

	public ExcelsiorCLI(DataSource datasource, Menu menu) {

		Controller controller = new Controller(datasource);
		this.controller = controller;
		this.menu = menu;
	}

	private void run() {
		boolean isFinished = false;
		while (!isFinished) {
			String choice = menu.mainMenu();
			if (choice.equals("1")) {
				callVenueDetails();
			} else if (choice.toUpperCase().equals("Q")) {
				isFinished = true;
			} else {
				menu.errorMessage();
			}
		}
	}

	// describes venue details: name, location, category, description
	private void callVenueDetails() {
		boolean isFinished = false;
		while (!isFinished) {
			String choice = "";
			try {
				choice = menu.viewVenues(controller.getAllVenues());
				if (choice.toUpperCase().equals("R")) {
					return; // how to exit loop
				} else if (Integer.parseInt(choice) >= 1 && Integer.parseInt(choice) <= 15) {
					int userInput = Integer.parseInt(choice);
					menu.venueDetails(controller.getVenueById(userInput),
							controller.getCategories(controller.getVenueById(userInput)));
					String venueName = controller.getVenueById(userInput).getName();
					listVenueSpaces(venueName);
					isFinished = true;
				} else {
					menu.errorMessage();
				}
			} catch (Exception e) {
				// menu.errorMessage();
				e.printStackTrace();
			}
		}
	}

	// lists venue spaces with open/close date, daily rate, max occupancy
	private void listVenueSpaces(String venueName) {
		boolean isFinished = false;

		String choice = menu.listSpaces(controller.getSpacesFromVenue(venueName));
		while (!isFinished) {
			try {
				if (choice.isEmpty() || choice.equals(null)) {
					menu.errorMessage();
				} else if (choice.toUpperCase().equals("R")) {
					callVenueDetails(); // how to exit loop
				} else if (choice.equals("1")) {
					reserveSpace(venueName);

				} else if (choice.equals("2")) {
					// menu.testMessage(); GET BACK TO THIS
				}
			} catch (Exception e) {
				e.printStackTrace();
				// menu.errorMessage();
			}
		}
	}

	private void reserveSpace(String venueName) {
		boolean isFinished = false;
		while (!isFinished) {
			String reserveDate = menu.reserveDate();
			int daysOfAttendence = menu.daysOfAttendence();
			int numberOfAttendees = menu.numberOfAttendees();
			List<Reservation> availableReservations = controller.getReservationAvailability(venueName, reserveDate,
					daysOfAttendence, numberOfAttendees);
			if (availableReservations.isEmpty()) {
				System.out.println("No space meets your needs. Try again.");
				break;
			}
			menu.availableReservations(availableReservations, daysOfAttendence);
			long spaceId = menu.whichSpaceToReserve(); // needs to take in space id, and return confirmation
			String spaceName = controller.getSpaceById(spaceId).get(0).getName();
			String reservationContact = menu.reservationContact();

			double totalCost = controller.getRateById(spaceId).get(0).getDailyRate();
			totalCost = totalCost * daysOfAttendence;

			LocalDate startDateAsLocal = convertStartDate(reserveDate);
			LocalDate end_date = startDateAsLocal.plusDays(daysOfAttendence);
			String endDateString = end_date.toString();
			menu.thankYouForReservation();
			menu.confirmationPrinter(daysOfAttendence, numberOfAttendees, venueName, spaceName, reserveDate,
					endDateString, reservationContact, totalCost);

			System.exit(0);
		}

	}

	private LocalDate convertStartDate(String startDate) {
		LocalDate localStartDate = LocalDate.parse(startDate);

		return localStartDate;
	}

}
